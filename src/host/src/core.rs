//! Keeps the .NET core running: starts it, restarts it if it stops on its own,
//! and gives up (telling every window) if it keeps falling.
//!
//! The host's own problems go to the app's log through the core, like the
//! interface's. While the core is away they wait in a short queue.

use std::collections::VecDeque;
use std::ffi::OsString;
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use crate::relay::{NOTIFICATION_EVENT, Relay, Routed};

/// Name of the .NET core sidecar declared in `tauri.conf.json` (`bundle.externalBin`).
const CORE_SIDECAR: &str = "rocinante-core";

/// Extension of project files.
const PROJECT_EXTENSION: &str = "rocinante";

/// Sent to every window when a new core has taken over: they reopen the project
/// and save what they have pending.
pub const RESTARTED_EVENT: &str = "core://restarted";

/// Sent to every window when the core keeps falling and is not started again.
pub const FAILED_EVENT: &str = "core://failed";

/// How many host problems wait for the core before the oldest are dropped.
const QUEUE_LIMIT: usize = 50;

/// Arguments for the core: where the app keeps its settings and its log and, on
/// the first start, the project the app was launched with (double click on a
/// `.rocinante`), for the first window to open.
pub fn core_args(
    data_dir: &Path,
    launch_args: impl IntoIterator<Item = OsString>,
) -> Vec<OsString> {
    let mut args = vec![
        OsString::from("--data-dir"),
        data_dir.as_os_str().to_owned(),
    ];
    let project = launch_args.into_iter().find(|arg| {
        Path::new(arg)
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case(PROJECT_EXTENSION))
    });
    if let Some(project) = project {
        args.push(OsString::from("--open"));
        args.push(project);
    }
    args
}

/// How often the core may be started again: no more than `limit` times within
/// `window`. A core that falls over and over is not going to recover by itself.
pub struct RestartBudget {
    limit: usize,
    window: Duration,
    starts: VecDeque<Instant>,
}

impl RestartBudget {
    pub fn new(limit: usize, window: Duration) -> Self {
        Self {
            limit,
            window,
            starts: VecDeque::new(),
        }
    }

    /// Whether another restart is allowed at `now`; if so, it counts.
    pub fn allow(&mut self, now: Instant) -> bool {
        while self
            .starts
            .front()
            .is_some_and(|start| now.duration_since(*start) >= self.window)
        {
            self.starts.pop_front();
        }
        if self.starts.len() >= self.limit {
            return false;
        }
        self.starts.push_back(now);
        true
    }
}

/// Everything the host keeps about the core.
pub struct Supervisor {
    exiting: AtomicBool,
    budget: Mutex<RestartBudget>,
    queue: Mutex<VecDeque<(&'static str, String)>>,
}

impl Supervisor {
    pub fn new() -> Self {
        Self {
            exiting: AtomicBool::new(false),
            budget: Mutex::new(RestartBudget::new(3, Duration::from_secs(60))),
            queue: Mutex::new(VecDeque::new()),
        }
    }

    /// The app is closing: the core stopping now is expected.
    pub fn exiting(&self) {
        self.exiting.store(true, Ordering::SeqCst);
    }
}

/// Writes a problem the host saw to the app's log, or keeps it until the core is back.
pub fn report(app: &AppHandle, level: &'static str, message: String) {
    eprintln!("rocinante: {message}");
    if app.state::<Relay>().is_connected() {
        send_report(app.clone(), level, message);
    } else {
        let supervisor = app.state::<Supervisor>();
        let mut queue = supervisor.queue.lock().expect("queue lock");
        if queue.len() == QUEUE_LIMIT {
            queue.pop_front();
        }
        queue.push_back((level, message));
    }
}

fn send_report(app: AppHandle, level: &'static str, message: String) {
    tauri::async_runtime::spawn(async move {
        let params = json!({ "source": "host", "level": level, "message": message });
        // If even the log is out of reach there is nowhere else to say it.
        let _ = app
            .state::<Relay>()
            .request("diagnostics.report".into(), params)
            .await;
    });
}

/// Writes the problems still waiting for the core to `logs/rocinante-host.log`,
/// next to the core's log: used when the core is gone for good, and on exit.
pub fn set_aside(app: &AppHandle) {
    let waiting: Vec<_> = app
        .state::<Supervisor>()
        .queue
        .lock()
        .expect("queue lock")
        .drain(..)
        .collect();
    if waiting.is_empty() {
        return;
    }
    let Ok(data) = app.path().app_data_dir() else {
        return;
    };
    let folder = data.join("logs");
    let file = std::fs::create_dir_all(&folder).and_then(|()| {
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(folder.join("rocinante-host.log"))
    });
    let Ok(mut file) = file else {
        return;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs());
    for (level, message) in waiting {
        let level = if level == "error" { "ERR" } else { "WRN" };
        let _ = writeln!(file, "{} [{level}] host: {message}", utc_stamp(now));
    }
}

/// A moment as `2026-11-18 22:42:09 UTC`, without pulling in a date library.
fn utc_stamp(seconds: u64) -> String {
    let days = i64::try_from(seconds / 86_400).unwrap_or(0);
    let rest = seconds % 86_400;
    // Civil date from days since 1970-01-01 (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02} UTC",
        rest / 3600,
        rest % 3600 / 60,
        rest % 60
    )
}

/// Starts the core; `first` is the start at launch, which passes on the launch file.
pub fn start(app: &AppHandle, first: bool) -> Result<(), Box<dyn std::error::Error>> {
    let launch_args = if first {
        std::env::args_os().skip(1).collect()
    } else {
        Vec::new()
    };
    let args = core_args(&app.path().app_data_dir()?, launch_args);
    let (mut events, child) = app.shell().sidecar(CORE_SIDECAR)?.args(args).spawn()?;

    app.state::<Relay>().connect(Box::new(child));
    let waiting: Vec<_> = app
        .state::<Supervisor>()
        .queue
        .lock()
        .expect("queue lock")
        .drain(..)
        .collect();
    for (level, message) in waiting {
        send_report(app.clone(), level, message);
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    if let Routed::Notification(message) = app.state::<Relay>().route(&line) {
                        if let Err(error) = app.emit(NOTIFICATION_EVENT, &message) {
                            report(
                                &app,
                                "error",
                                format!("could not broadcast a notification: {error}"),
                            );
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line = String::from_utf8_lossy(&line).trim_end().to_owned();
                    if !line.is_empty() {
                        report(&app, "warning", format!("core said: {line}"));
                    }
                }
                CommandEvent::Terminated(status) => {
                    stopped(&app, status.code);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// The core process ended: start another one, unless the app is closing or the
/// core keeps falling.
fn stopped(app: &AppHandle, code: Option<i32>) {
    let relay = app.state::<Relay>();
    let unanswered = relay.disconnect();
    let supervisor = app.state::<Supervisor>();
    if supervisor.exiting.load(Ordering::SeqCst) {
        return;
    }

    let code = code.map_or_else(
        || "no exit code".to_owned(),
        |code| format!("exit code {code}"),
    );
    let allowed = supervisor
        .budget
        .lock()
        .expect("budget lock")
        .allow(Instant::now());
    if !allowed {
        report(
            app,
            "error",
            format!("core stopped ({code}) too many times; not starting it again"),
        );
        // No core is left to write it: what the host had to say goes in a file of its own.
        set_aside(app);
        let _ = app.emit(FAILED_EVENT, ());
        return;
    }

    report(
        app,
        "error",
        format!("core stopped ({code}) with {unanswered} requests unanswered; starting it again"),
    );
    match start(app, false) {
        Ok(()) => {
            let _ = app.emit(RESTARTED_EVENT, ());
        }
        Err(error) => {
            report(
                app,
                "error",
                format!("core could not be started again: {error}"),
            );
            let _ = app.emit(FAILED_EVENT, ());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<OsString> {
        values.iter().map(OsString::from).collect()
    }

    #[test]
    fn the_core_always_gets_the_data_folder() {
        let result = core_args(Path::new("/datos/rocinante"), args(&[]));

        assert_eq!(result, args(&["--data-dir", "/datos/rocinante"]));
    }

    #[test]
    fn a_project_the_app_was_launched_with_is_passed_on() {
        let result = core_args(Path::new("/datos"), args(&["/obras/Don Quijote.rocinante"]));

        assert_eq!(
            result,
            args(&[
                "--data-dir",
                "/datos",
                "--open",
                "/obras/Don Quijote.rocinante"
            ])
        );
    }

    #[test]
    fn the_extension_is_matched_without_case_and_other_arguments_are_ignored() {
        let result = core_args(
            Path::new("/datos"),
            args(&[
                "--verbose",
                "notas.txt",
                "C:/Obras/GALATEA.ROCINANTE",
                "otra.rocinante",
            ]),
        );

        assert_eq!(
            result,
            args(&[
                "--data-dir",
                "/datos",
                "--open",
                "C:/Obras/GALATEA.ROCINANTE"
            ])
        );
    }

    #[test]
    fn moments_are_written_in_utc_without_a_date_library() {
        assert_eq!(utc_stamp(0), "1970-01-01 00:00:00 UTC");
        assert_eq!(utc_stamp(951_782_400), "2000-02-29 00:00:00 UTC");
        assert_eq!(utc_stamp(1_795_560_129), "2026-11-24 22:42:09 UTC");
    }

    #[test]
    fn a_core_that_falls_now_and_then_is_always_started_again() {
        let mut budget = RestartBudget::new(3, Duration::from_secs(60));
        let start = Instant::now();

        for minute in 0..10 {
            assert!(budget.allow(start + Duration::from_secs(minute * 61)));
        }
    }

    #[test]
    fn a_core_that_keeps_falling_is_given_up_until_time_passes() {
        let mut budget = RestartBudget::new(3, Duration::from_secs(60));
        let start = Instant::now();

        assert!(budget.allow(start));
        assert!(budget.allow(start + Duration::from_secs(1)));
        assert!(budget.allow(start + Duration::from_secs(2)));
        assert!(!budget.allow(start + Duration::from_secs(3)));
        assert!(!budget.allow(start + Duration::from_secs(59)));
        assert!(budget.allow(start + Duration::from_secs(60)));
    }
}

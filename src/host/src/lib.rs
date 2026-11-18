mod relay;

use std::ffi::OsString;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};

use serde_json::Value;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use relay::Relay;

/// Name of the .NET core sidecar declared in `tauri.conf.json` (`bundle.externalBin`).
const CORE_SIDECAR: &str = "rocinante-core";

/// Extension of project files.
const PROJECT_EXTENSION: &str = "rocinante";

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// Forwards a request from any window to the core.
#[tauri::command]
async fn core_request(
    relay: State<'_, Relay>,
    method: String,
    params: Value,
) -> Result<Value, Value> {
    relay.request(method, params).await
}

/// Opens another window on the same project.
///
/// Must be `async`: building a window from a synchronous command deadlocks on Windows.
#[tauri::command]
async fn open_window(app: AppHandle) -> Result<(), String> {
    let label = format!("window-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed));
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
        .title("Rocinante")
        .inner_size(900.0, 700.0)
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Arguments for the core: where the app keeps its settings and, if the app was launched with a
/// project (double click on a `.rocinante`), that file, for the first window to open.
fn core_args(data_dir: &Path, launch_args: impl IntoIterator<Item = OsString>) -> Vec<OsString> {
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

fn start_core(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let args = core_args(&app.path().app_data_dir()?, std::env::args_os().skip(1));
    let (mut events, child) = app.shell().sidecar(CORE_SIDECAR)?.args(args).spawn()?;

    app.manage(Relay::new(child));

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => app.state::<Relay>().dispatch(&app, &line),
                CommandEvent::Stderr(line) => eprintln!("core: {}", String::from_utf8_lossy(&line)),
                CommandEvent::Terminated(status) => eprintln!("core terminated: {status:?}"),
                _ => {}
            }
        }
    });

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            start_core(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_request, open_window])
        .run(tauri::generate_context!())
        .expect("error while running Rocinante");
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
}

mod ambience;
mod core;
mod relay;

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};

use serde_json::Value;
#[cfg(target_os = "macos")]
use tauri::Emitter;
use tauri::{AppHandle, Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder};

use crate::core::Supervisor;
use relay::Relay;

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// The app, for the panic hook, which cannot be handed anything.
static APP: OnceLock<AppHandle> = OnceLock::new();

/// The event that tells the main window the system asked to open a work (macOS sends it with a double
/// click on a `.rocinante`, after the app has started).
pub const OPENED_EVENT: &str = "rocinante://opened";

/// The works the system asked to open and the window has not yet taken.
#[derive(Default)]
struct OpenedFiles(Mutex<Vec<String>>);

/// The works the system asked to open since the window last asked, the latest last.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)] // Tauri hands the state over by value.
fn take_opened_files(opened: State<'_, OpenedFiles>) -> Vec<String> {
    opened
        .0
        .lock()
        .map(|mut files| std::mem::take(&mut *files))
        .unwrap_or_default()
}

/// Forwards a request from any window to the core.
#[tauri::command]
async fn core_request(
    relay: State<'_, Relay>,
    method: String,
    params: Value,
) -> Result<Value, Value> {
    relay.request(method, params).await
}

/// Opens another window on the same project. With `board`, the window shows only the board: its label
/// starts with `board-`, which is how the interface knows.
///
/// Must be `async`: building a window from a synchronous command deadlocks on Windows.
#[tauri::command]
async fn open_window(app: AppHandle, board: Option<bool>) -> Result<(), String> {
    let board = board.unwrap_or(false);
    let label = format!(
        "{}-{}",
        if board { "board" } else { "window" },
        WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed)
    );
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
        .title(if board {
            "Rocinante · Tablero"
        } else {
            "Rocinante"
        })
        .inner_size(if board { 1100.0 } else { 900.0 }, 700.0)
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Shows the folder of the app's log in the system's file manager, so the writer
/// can send it along when something went wrong.
#[tauri::command]
async fn open_log_folder(app: AppHandle) -> Result<(), String> {
    let folder = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("logs");
    std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    show_folder(&folder).map_err(|error| error.to_string())
}

/// Shows an exported book in the system's file manager, selected where the system allows it. Only an
/// existing file is shown: the command opens nothing else.
#[tauri::command]
async fn reveal_file(path: String) -> Result<(), String> {
    let file = Path::new(&path);
    if !file.is_file() {
        return Err("not a file".into());
    }
    reveal(file).map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn reveal(file: &Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    // Explorer reads its own arguments: the path goes quoted after the comma, as it is.
    Command::new("explorer")
        .raw_arg(format!("/select,\"{}\"", file.display()))
        .spawn()
        .map(|_| ())
}

#[cfg(target_os = "macos")]
fn reveal(file: &Path) -> std::io::Result<()> {
    Command::new("open").arg("-R").arg(file).spawn().map(|_| ())
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn reveal(file: &Path) -> std::io::Result<()> {
    show_folder(file.parent().unwrap_or(file))
}

fn show_folder(folder: &Path) -> std::io::Result<()> {
    let program = if cfg!(target_os = "windows") {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    Command::new(program).arg(folder).spawn().map(|_| ())
}

pub fn run() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(app) = APP.get() {
            core::report(app, "error", format!("host panicked: {info}"));
        }
        default_hook(info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol(
            ambience::SCHEME,
            |context, request, responder| {
                ambience::serve(context.app_handle(), &request, responder);
            },
        )
        .manage(Relay::new())
        .manage(Supervisor::new())
        .manage(OpenedFiles::default())
        .setup(|app| {
            let _ = APP.set(app.handle().clone());
            core::start(app.handle(), true)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_request,
            open_window,
            open_log_folder,
            reveal_file,
            take_opened_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building Rocinante")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Opened { urls } = &event {
                let files = urls.iter().filter_map(|url| url.to_file_path().ok());
                if let Ok(mut opened) = app.state::<OpenedFiles>().0.lock() {
                    opened.extend(files.map(|file| file.display().to_string()));
                }
                let _ = app.emit_to("main", OPENED_EVENT, ());
            }
            // From here on the core stopping is the app closing, not a fall.
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                app.state::<Supervisor>().exiting();
            }
            if matches!(event, RunEvent::Exit) {
                core::set_aside(app);
            }
        });
}

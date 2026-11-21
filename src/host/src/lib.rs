mod core;
mod relay;

use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, Ordering};

use serde_json::Value;
use tauri::{AppHandle, Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder};

use crate::core::Supervisor;
use relay::Relay;

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

/// The folder of the app data folder where the core keeps the writer's own images and sounds.
const AMBIENCE_FOLDER: &str = "ambience";

/// The app, for the panic hook, which cannot be handed anything.
static APP: OnceLock<AppHandle> = OnceLock::new();

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

/// Lets the windows read, through the asset protocol, the copies of the writer's own images
/// and sounds that the core keeps in the app data folder, and nothing else. The folder is
/// created first: the scope is matched against its real path, which on Windows is only known
/// once it exists.
fn allow_ambience(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let folder = app.path().app_data_dir()?.join(AMBIENCE_FOLDER);
    std::fs::create_dir_all(&folder)?;
    app.asset_protocol_scope().allow_directory(&folder, false)?;
    Ok(())
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
        .manage(Relay::new())
        .manage(Supervisor::new())
        .setup(|app| {
            let _ = APP.set(app.handle().clone());
            allow_ambience(app.handle())?;
            core::start(app.handle(), true)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core_request,
            open_window,
            open_log_folder
        ])
        .build(tauri::generate_context!())
        .expect("error while building Rocinante")
        .run(|app, event| {
            // From here on the core stopping is the app closing, not a fall.
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                app.state::<Supervisor>().exiting();
            }
            if matches!(event, RunEvent::Exit) {
                core::set_aside(app);
            }
        });
}

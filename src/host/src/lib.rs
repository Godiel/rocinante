mod relay;

use std::sync::atomic::{AtomicU32, Ordering};

use serde_json::Value;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use relay::Relay;

/// Name of the .NET core sidecar declared in `tauri.conf.json` (`bundle.externalBin`).
const CORE_SIDECAR: &str = "rocinante-core";

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

fn start_core(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // The core starts with no project open: the UI creates or opens one.
    let (mut events, child) = app.shell().sidecar(CORE_SIDECAR)?.spawn()?;

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
        .setup(|app| {
            start_core(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![core_request, open_window])
        .run(tauri::generate_context!())
        .expect("error while running Rocinante");
}

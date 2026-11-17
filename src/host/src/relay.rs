//! Relay between every window and the single .NET core process.
//!
//! Windows never talk to the core directly. The relay assigns each request a
//! JSON-RPC id, writes it to the core's stdin and hands the matching response
//! back to the caller. Messages without an id are notifications and are
//! broadcast to all windows, which is how windows stay in sync.

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::oneshot;

pub const NOTIFICATION_EVENT: &str = "core://notification";

type Reply = Result<Value, Value>;

pub struct Relay {
    child: Mutex<CommandChild>,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Reply>>>,
}

impl Relay {
    pub fn new(child: CommandChild) -> Self {
        Self {
            child: Mutex::new(child),
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
        }
    }

    /// Sends a request to the core and waits for its response.
    pub async fn request(&self, method: String, params: Value) -> Reply {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();
        self.pending
            .lock()
            .expect("pending lock")
            .insert(id, sender);

        let mut message = json!({ "jsonrpc": "2.0", "id": id, "method": method });
        if !params.is_null() {
            message["params"] = params;
        }
        let mut line = message.to_string();
        line.push('\n');

        let written = self
            .child
            .lock()
            .expect("child lock")
            .write(line.as_bytes());
        if let Err(error) = written {
            self.pending.lock().expect("pending lock").remove(&id);
            return Err(json!({ "code": -32000, "message": format!("core unavailable: {error}") }));
        }

        receiver
            .await
            .unwrap_or_else(|_| Err(json!({ "code": -32000, "message": "core closed" })))
    }

    /// Routes one line printed by the core: a response or a notification.
    pub fn dispatch(&self, app: &AppHandle, line: &[u8]) {
        let Ok(message) = serde_json::from_slice::<Value>(line) else {
            eprintln!("relay: ignoring non-JSON output from core");
            return;
        };

        match message.get("id").and_then(Value::as_u64) {
            Some(id) => {
                let sender = self.pending.lock().expect("pending lock").remove(&id);
                if let Some(sender) = sender {
                    let reply = match message.get("error") {
                        Some(error) => Err(error.clone()),
                        None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
                    };
                    // The caller may have gone away; nothing to do then.
                    let _ = sender.send(reply);
                }
            }
            None => {
                if let Err(error) = app.emit(NOTIFICATION_EVENT, &message) {
                    eprintln!("relay: failed to broadcast notification: {error}");
                }
            }
        }
    }
}

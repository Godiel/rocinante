//! Relay between every window and the single .NET core process.
//!
//! Windows never talk to the core directly. The relay assigns each request a
//! JSON-RPC id, writes it to the core's stdin and hands the matching response
//! back to the caller. Messages without an id are notifications and are
//! broadcast to all windows, which is how windows stay in sync.
//!
//! The core may stop and be started again: while it is away, requests fail at
//! once with `CORE_UNAVAILABLE`, and the ones that were waiting are answered
//! with that error too, so no window waits forever.

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{Value, json};
use tokio::sync::oneshot;

pub const NOTIFICATION_EVENT: &str = "core://notification";

/// JSON-RPC error code for "the core is not there right now" (see the contract).
pub const CORE_UNAVAILABLE: i64 = -32000;

type Reply = Result<Value, Value>;

/// Where requests are written: the core's stdin, or a fake one in tests.
pub trait CoreInput: Send {
    fn write(&mut self, bytes: &[u8]) -> Result<(), String>;
}

impl CoreInput for tauri_plugin_shell::process::CommandChild {
    fn write(&mut self, bytes: &[u8]) -> Result<(), String> {
        tauri_plugin_shell::process::CommandChild::write(self, bytes)
            .map_err(|error| error.to_string())
    }
}

/// What a line printed by the core turned out to be.
#[derive(Debug, PartialEq)]
pub enum Routed {
    /// The response to a request, handed to whoever asked.
    Reply,
    /// A notification, to broadcast to every window.
    Notification(Value),
    /// Not JSON-RPC, or the answer to a request nobody waits for any more.
    Ignored,
}

pub struct Relay {
    input: Mutex<Option<Box<dyn CoreInput>>>,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, oneshot::Sender<Reply>>>,
}

fn unavailable(reason: &str) -> Value {
    json!({ "code": CORE_UNAVAILABLE, "message": format!("core unavailable: {reason}") })
}

impl Relay {
    /// A relay with no core yet: requests fail until one is connected.
    pub fn new() -> Self {
        Self {
            input: Mutex::new(None),
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
        }
    }

    /// Starts writing to a (new) core.
    pub fn connect(&self, input: Box<dyn CoreInput>) {
        *self.input.lock().expect("input lock") = Some(input);
    }

    /// The core is gone: stop writing to it and answer every waiting request with
    /// `CORE_UNAVAILABLE`. Returns how many requests were waiting.
    pub fn disconnect(&self) -> usize {
        self.input.lock().expect("input lock").take();
        let waiting: Vec<_> = self.pending.lock().expect("pending lock").drain().collect();
        let count = waiting.len();
        for (_, sender) in waiting {
            // The caller may have gone away; nothing to do then.
            let _ = sender.send(Err(unavailable("it stopped before answering")));
        }
        count
    }

    pub fn is_connected(&self) -> bool {
        self.input.lock().expect("input lock").is_some()
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

        let written = match self.input.lock().expect("input lock").as_mut() {
            Some(input) => input.write(line.as_bytes()),
            None => Err("it is starting again".to_owned()),
        };
        if let Err(error) = written {
            self.pending.lock().expect("pending lock").remove(&id);
            return Err(unavailable(&error));
        }

        receiver
            .await
            .unwrap_or_else(|_| Err(unavailable("it closed")))
    }

    /// Routes one line printed by the core: a response goes to its caller, a
    /// notification comes back to be broadcast.
    pub fn route(&self, line: &[u8]) -> Routed {
        let Ok(message) = serde_json::from_slice::<Value>(line) else {
            return Routed::Ignored;
        };

        match message.get("id").and_then(Value::as_u64) {
            Some(id) => {
                let Some(sender) = self.pending.lock().expect("pending lock").remove(&id) else {
                    return Routed::Ignored;
                };
                let reply = match message.get("error") {
                    Some(error) => Err(error.clone()),
                    None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
                };
                let _ = sender.send(reply);
                Routed::Reply
            }
            None if message.get("method").is_some() => Routed::Notification(message),
            None => Routed::Ignored,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    /// A core input that keeps what was written, or refuses to write.
    #[derive(Clone, Default)]
    struct FakeCore {
        written: Arc<Mutex<Vec<String>>>,
        broken: bool,
    }

    impl CoreInput for FakeCore {
        fn write(&mut self, bytes: &[u8]) -> Result<(), String> {
            if self.broken {
                return Err("broken pipe".to_owned());
            }
            self.written
                .lock()
                .unwrap()
                .push(String::from_utf8(bytes.to_vec()).unwrap());
            Ok(())
        }
    }

    fn connected() -> (Arc<Relay>, FakeCore) {
        let relay = Arc::new(Relay::new());
        let core = FakeCore::default();
        relay.connect(Box::new(core.clone()));
        (relay, core)
    }

    /// Lets a spawned request reach the point where it waits for its answer.
    async fn settle() {
        for _ in 0..10 {
            tokio::task::yield_now().await;
        }
    }

    fn sent(core: &FakeCore) -> Vec<Value> {
        core.written
            .lock()
            .unwrap()
            .iter()
            .map(|line| {
                assert!(line.ends_with('\n'), "one message per line");
                serde_json::from_str(line).unwrap()
            })
            .collect()
    }

    #[tokio::test]
    async fn a_request_is_written_as_one_json_rpc_line_and_gets_its_own_answer() {
        let (relay, core) = connected();

        let first = tokio::spawn({
            let relay = relay.clone();
            async move {
                relay
                    .request("document.get".into(), json!({ "id": "a" }))
                    .await
            }
        });
        let second = tokio::spawn({
            let relay = relay.clone();
            async move { relay.request("system.ping".into(), Value::Null).await }
        });
        settle().await;

        let messages = sent(&core);
        assert_eq!(messages.len(), 2);
        let ping = messages
            .iter()
            .find(|m| m["method"] == "system.ping")
            .unwrap();
        assert!(
            ping.get("params").is_none(),
            "no params when there are none"
        );
        let get = messages
            .iter()
            .find(|m| m["method"] == "document.get")
            .unwrap();
        assert_eq!(get["jsonrpc"], "2.0");

        // Answers may come in any order.
        let ping_id = ping["id"].as_u64().unwrap();
        let get_id = get["id"].as_u64().unwrap();
        let ping_answer = json!({ "jsonrpc": "2.0", "id": ping_id, "result": "pong" }).to_string();
        let get_answer =
            json!({ "jsonrpc": "2.0", "id": get_id, "error": { "code": -32001 } }).to_string();
        assert_eq!(relay.route(ping_answer.as_bytes()), Routed::Reply);
        assert_eq!(relay.route(get_answer.as_bytes()), Routed::Reply);

        assert_eq!(second.await.unwrap(), Ok(json!("pong")));
        assert_eq!(first.await.unwrap(), Err(json!({ "code": -32001 })));
    }

    #[test]
    fn notifications_come_back_to_be_broadcast_and_noise_is_ignored() {
        let (relay, _) = connected();
        let notification = json!({ "jsonrpc": "2.0", "method": "project.changed", "params": {} });

        assert_eq!(
            relay.route(notification.to_string().as_bytes()),
            Routed::Notification(notification)
        );
        assert_eq!(relay.route(b"Unhandled exception"), Routed::Ignored);
        assert_eq!(
            relay.route(br#"{"jsonrpc":"2.0","id":99,"result":null}"#),
            Routed::Ignored
        );
        assert_eq!(relay.route(br#"{"jsonrpc":"2.0"}"#), Routed::Ignored);
    }

    #[tokio::test]
    async fn without_a_core_a_request_fails_at_once() {
        let relay = Relay::new();

        let reply = relay.request("system.ping".into(), Value::Null).await;

        assert_eq!(reply.unwrap_err()["code"], CORE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn a_core_that_cannot_be_written_to_fails_the_request() {
        let relay = Relay::new();
        relay.connect(Box::new(FakeCore {
            broken: true,
            ..FakeCore::default()
        }));

        let reply = relay.request("system.ping".into(), Value::Null).await;

        assert_eq!(reply.unwrap_err()["code"], CORE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn when_the_core_stops_every_waiting_request_is_answered_and_a_new_core_takes_over() {
        let (relay, _) = connected();
        let waiting = tokio::spawn({
            let relay = relay.clone();
            async move { relay.request("document.save".into(), json!({})).await }
        });
        settle().await;

        assert_eq!(relay.disconnect(), 1);
        assert!(!relay.is_connected());
        assert_eq!(
            waiting.await.unwrap().unwrap_err()["code"],
            CORE_UNAVAILABLE
        );

        let fresh = FakeCore::default();
        relay.connect(Box::new(fresh.clone()));
        let again = tokio::spawn({
            let relay = relay.clone();
            async move { relay.request("system.ping".into(), Value::Null).await }
        });
        settle().await;
        let id = sent(&fresh)[0]["id"].as_u64().unwrap();
        relay.route(
            json!({ "jsonrpc": "2.0", "id": id, "result": "pong" })
                .to_string()
                .as_bytes(),
        );

        assert_eq!(again.await.unwrap(), Ok(json!("pong")));
    }
}

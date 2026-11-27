// Runs in the page before the interface. It stands in for what Tauri puts in a real window, so
// the interface runs unchanged in a browser: requests to the core go to the test relay, the
// core's notifications come back from it, and the system dialogs answer with what the test chose.
(() => {
  const callbacks = new Map();
  /** event name -> (listener id -> callback id) */
  const listeners = new Map();
  let nextId = 1;

  function emit(event, payload) {
    for (const [id, callback] of listeners.get(event) ?? []) {
      callbacks.get(callback)?.({ event, id, payload });
    }
  }

  // The label of this window: `main`, or another one named in the address, as a second window of the work.
  const label = new URLSearchParams(location.search).get("window") ?? "main";

  const picks = [];
  window.__rocinanteE2E = {
    /** What the next system dialogs answer, in order. */
    picks,
    /** Asks the window to close, as clicking its close button does. */
    requestClose: () => emit("tauri://close-requested", null),
  };

  new EventSource("/events").onmessage = (message) => {
    const { event, payload } = JSON.parse(message.data);
    emit(event, payload);
  };

  // Whether the page asked to go full screen; a browser test cannot leave the window.
  let fullscreen = false;

  async function invoke(command, args = {}) {
    switch (command) {
      case "core_request": {
        const response = await fetch("/rpc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method: args.method, params: args.params ?? null }),
        });
        const reply = await response.json();
        if ("error" in reply) throw reply.error;
        return reply.result;
      }
      case "plugin:event|listen": {
        const id = nextId++;
        if (!listeners.has(args.event)) listeners.set(args.event, new Map());
        listeners.get(args.event).set(id, args.handler);
        return id;
      }
      case "plugin:dialog|open":
      case "plugin:dialog|save":
        return picks.shift() ?? null;
      case "plugin:window|set_fullscreen":
        fullscreen = Boolean(args.value);
        return null;
      case "plugin:window|is_fullscreen":
        return fullscreen;
      case "plugin:window|destroy":
        await fetch("/window/destroy", { method: "POST" });
        return null;
      default:
        // Opening another window or the log folder has nothing to do in a browser.
        return null;
    }
  }

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label },
      currentWebview: { windowLabel: label, label },
    },
    invoke,
    transformCallback(callback, once = false) {
      const id = nextId++;
      callbacks.set(id, (data) => {
        if (once) callbacks.delete(id);
        return callback?.(data);
      });
      return id;
    },
    unregisterCallback: (id) => callbacks.delete(id),
    // The relay serves the ambience folder of the data folder, as the asset protocol does.
    convertFileSrc: (path) => `/ambience/${encodeURIComponent(path.split(/[\\/]/).pop())}`,
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (event, id) => listeners.get(event)?.delete(id),
  };
})();

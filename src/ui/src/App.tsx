import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { onNotification, request } from "./bridge/core";

// Walking skeleton for feature 001: one document shared live across windows.

interface DocumentState {
  content: JSONContent | null;
  revision: number;
}

interface DocumentChanged extends DocumentState {
  origin: string;
}

const SAVE_DELAY_MS = 300;
const windowLabel = getCurrentWebviewWindow().label;

export default function App() {
  const [revision, setRevision] = useState(0);
  const [latency, setLatency] = useState<string>("—");
  const saveTimer = useRef<number | undefined>(undefined);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void request<{ revision: number }>("document.save", {
          content: current.getJSON(),
          origin: windowLabel,
        }).then((result) => setRevision(result.revision));
      }, SAVE_DELAY_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;

    void request<DocumentState>("document.get").then((state) => {
      if (state.content) editor.commands.setContent(state.content, { emitUpdate: false });
      setRevision(state.revision);
    });

    const unlisten = onNotification((notification) => {
      if (notification.method !== "document.changed") return;
      const change = notification.params as DocumentChanged;
      setRevision(change.revision);
      if (change.origin !== windowLabel && change.content) {
        editor.commands.setContent(change.content, { emitUpdate: false });
      }
    });

    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [editor]);

  async function measureLatency() {
    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await request("system.ping");
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const percentile = (p: number) => samples[Math.floor(samples.length * p)] ?? Number.NaN;
    setLatency(`mediana ${percentile(0.5).toFixed(2)} ms · p95 ${percentile(0.95).toFixed(2)} ms`);
  }

  return (
    <main className="skeleton">
      <header>
        <span>
          Ventana «{windowLabel}» · revisión {revision}
        </span>
        <button onClick={() => void invoke("open_window")}>Abrir otra ventana</button>
        <button onClick={() => void measureLatency()}>Medir latencia</button>
        <span>{latency}</span>
      </header>
      <EditorContent editor={editor} className="page" />
    </main>
  );
}

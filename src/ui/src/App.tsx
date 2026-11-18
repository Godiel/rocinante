import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ensureCompatibleCore, onNotification, request } from "./bridge/core";
import { toTipTapDocument } from "./bridge/document";

// Walking skeleton for feature 001: one document shared live across windows.

const SAVE_DELAY_MS = 300;
const windowLabel = getCurrentWebviewWindow().label;

export default function App() {
  const [revision, setRevision] = useState(0);
  const [latency, setLatency] = useState<string>("—");
  const [problem, setProblem] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void request("document.save", {
          content: toTipTapDocument(current.getJSON()),
          origin: windowLabel,
        }).then((result) => setRevision(result.revision));
      }, SAVE_DELAY_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;

    void ensureCompatibleCore()
      .then(() => request("document.get"))
      .then((state) => {
        if (state.content) editor.commands.setContent(state.content, { emitUpdate: false });
        setRevision(state.revision);
      })
      .catch((error: unknown) => {
        console.error(error);
        setProblem("No se pudo conectar con el núcleo de Rocinante.");
      });

    const unlisten = onNotification("document.changed", (change) => {
      setRevision(change.revision);
      if (change.origin !== windowLabel) {
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
      {problem && <p role="alert">{problem}</p>}
      <EditorContent editor={editor} className="page" />
    </main>
  );
}

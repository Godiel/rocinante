import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { CoreError, ensureCompatibleCore, onNotification, request } from "./bridge/core";
import { toTipTapDocument } from "./bridge/document";
import type { Place, ProjectState, StartState } from "./bridge/generated/protocol";

// Development shell until the welcome screen (block 8) and the editor (block 9) exist. It starts
// the way the app will: the project left open last time, or the one the app was launched with.
// Without one, it opens a development project in Documents/Rocinante. It returns to the chapter
// and cursor where the writer left off.

const SAVE_DELAY_MS = 300;
const PLACE_DELAY_MS = 1000;
const DEVELOPMENT_PROJECT = "desarrollo.rocinante";
const windowLabel = getCurrentWebviewWindow().label;

interface Opened {
  project: ProjectState;
  place: Place | null;
}

/** The project to work on: the one the core opened on start, or the development one. */
async function openProject(start: StartState): Promise<Opened> {
  if (start.project) return { project: start.project, place: start.place };
  if (start.problem)
    console.warn(`could not reopen ${start.problem.path}: ${start.problem.reason}`);

  const path = await join(start.defaultFolder, DEVELOPMENT_PROJECT);
  try {
    const project = await request("project.open", { path, origin: windowLabel });
    return { project, place: await request("place.get") };
  } catch (error) {
    if (!(error instanceof CoreError) || error.reason !== "notFound") throw error;
    const project = await request("project.create", {
      path,
      title: "Proyecto de desarrollo",
      origin: windowLabel,
    });
    return { project, place: null };
  }
}

/** The document to show: where the writer left off, or the first chapter (created if none). */
async function documentToShow({ project, place }: Opened): Promise<string> {
  if (place) return place.documentId;
  const chapter = project.index.chapters[0];
  if (chapter) return chapter.id;
  const created = await request("document.create", {
    kind: "chapter",
    title: "Capítulo primero",
    origin: windowLabel,
  });
  return created.id;
}

export default function App() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [status, setStatus] = useState("—");
  const [latency, setLatency] = useState<string>("—");
  const [problem, setProblem] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const placeTimer = useRef<number | undefined>(undefined);
  const documentRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) => {
      const id = documentRef.current;
      if (!id) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void request("document.save", {
          id,
          content: toTipTapDocument(current.getJSON()),
          origin: windowLabel,
        }).then((saved) =>
          setStatus(`revisión ${saved.revision} · ${saved.statistics.words} palabras`),
        );
      }, SAVE_DELAY_MS);
    },
    onSelectionUpdate: ({ editor: current }) => {
      const id = documentRef.current;
      if (!id) return;
      const { anchor, head } = current.state.selection;
      window.clearTimeout(placeTimer.current);
      placeTimer.current = window.setTimeout(() => {
        void request("place.save", { documentId: id, anchor, head });
      }, PLACE_DELAY_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;

    void ensureCompatibleCore()
      .then(() => request("app.start", { origin: windowLabel }))
      .then(openProject)
      .then(async (opened) => {
        const id = await documentToShow(opened);
        const document = await request("document.get", { id });
        documentRef.current = id;
        setDocumentId(id);
        editor.commands.setContent(document.content, { emitUpdate: false });
        const place = opened.place?.documentId === id ? opened.place : null;
        if (place) {
          const end = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.min(place.anchor, end),
            to: Math.min(place.head, end),
          });
        }
        editor.commands.focus();
        setStatus(`revisión ${document.revision} · ${document.statistics.words} palabras`);
      })
      .catch((error: unknown) => {
        console.error(error);
        setProblem("No se pudo abrir el proyecto de desarrollo.");
      });

    const unlisten = onNotification("document.changed", (change) => {
      if (change.document.id !== documentRef.current) return;
      setStatus(
        `revisión ${change.document.revision} · ${change.document.statistics.words} palabras`,
      );
      if (change.origin !== windowLabel) {
        editor.commands.setContent(change.document.content, { emitUpdate: false });
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
          Ventana «{windowLabel}» · {documentId ? status : "abriendo…"}
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

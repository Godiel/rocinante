import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { invoke } from "@tauri-apps/api/core";
import { onNotification, request } from "../../bridge/core";
import { toTipTapDocument } from "../../bridge/document";
import type { Place, ProjectState, Theme } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import "./dev-editor.css";

// Temporary writing view until the editor of block 9: one chapter, saved after a pause, live
// across windows, and back to where the writer left off. It already sits on the design tokens.

const SAVE_DELAY_MS = 300;
const PLACE_DELAY_MS = 1000;

interface DevEditorProps {
  project: ProjectState;
  place: Place | null;
  theme: Theme;
  origin: string;
}

export function DevEditor({ project, place, theme, origin }: DevEditorProps) {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [words, setWords] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const placeTimer = useRef<number | undefined>(undefined);
  const documentRef = useRef<string | null>(null);
  // The project and place only matter when the view opens; later changes arrive as notifications.
  const opening = useRef({ project, place, origin });

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    onUpdate: ({ editor: current }) => {
      const id = documentRef.current;
      if (!id) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        request("document.save", { id, content: toTipTapDocument(current.getJSON()), origin })
          .then((saved) => setWords(saved.statistics.words))
          .catch((error: unknown) => setProblem(messageFor(error)));
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
    const { project: opened, place: left, origin: self } = opening.current;

    async function documentToShow(): Promise<string> {
      if (left) return left.documentId;
      const chapter = opened.index.chapters[0];
      if (chapter) return chapter.id;
      const created = await request("document.create", {
        kind: "chapter",
        title: "Capítulo primero",
        origin: self,
      });
      return created.id;
    }

    documentToShow()
      .then(async (id) => {
        const document = await request("document.get", { id });
        documentRef.current = id;
        setDocumentId(id);
        setWords(document.statistics.words);
        editor.commands.setContent(document.content, { emitUpdate: false });
        if (left?.documentId === id) {
          const end = editor.state.doc.content.size;
          editor.commands.setTextSelection({
            from: Math.min(left.anchor, end),
            to: Math.min(left.head, end),
          });
        }
        editor.commands.focus();
      })
      .catch((error: unknown) => setProblem(messageFor(error)));

    const unlisten = onNotification("document.changed", (change) => {
      if (change.document.id !== documentRef.current) return;
      setWords(change.document.statistics.words);
      if (change.origin !== self) {
        editor.commands.setContent(change.document.content, { emitUpdate: false });
      }
    });

    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [editor]);

  const otherTheme: Theme = theme === "paper" ? "candlelight" : "paper";

  return (
    <div className="dev-editor">
      <header className="dev-editor-bar small-caps">
        <span>
          {project.title}
          {documentId && words !== null && (
            <span className="dev-editor-count"> · {words} palabras</span>
          )}
        </span>
        <nav aria-label="Proyecto">
          <button
            className="action"
            onClick={() =>
              void request("preferences.update", { changes: { theme: otherTheme }, origin })
            }
          >
            {otherTheme === "candlelight" ? "Luz de vela" : "Papel"}
          </button>
          <button className="action" onClick={() => void invoke("open_window")}>
            Otra ventana
          </button>
          <button className="action" onClick={() => void request("project.close", { origin })}>
            Cerrar proyecto
          </button>
        </nav>
      </header>
      {problem && (
        <p className="dev-editor-problem" role="alert">
          {problem}
        </p>
      )}
      <EditorContent editor={editor} className="dev-editor-page" />
    </div>
  );
}

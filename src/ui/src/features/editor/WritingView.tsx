import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { request } from "../../bridge/core";
import type {
  DocumentEntry,
  DocumentState,
  Place,
  Preferences,
  ProjectState,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { savePendingNow } from "../../editor/pending-saves";
import { isOutlineShortcut } from "../outline/shortcut";
import { Outline } from "../outline/Outline";
import { UndoNotice } from "../outline/UndoNotice";
import { BookEditor } from "./BookEditor";
import "./writing-view.css";

interface WritingViewProps {
  project: ProjectState;
  place: Place | null;
  preferences: Preferences;
  origin: string;
}

/**
 * The open project: the index on one side and the chapter or fragment being written. It opens
 * where the writer left off, or on the first chapter.
 */
export function WritingView({ project, place, preferences, origin }: WritingViewProps) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [words, setWords] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(preferences.outline === "docked");
  const [deleted, setDeleted] = useState<DocumentEntry | null>(null);
  // The project and place only matter when the view opens; later changes arrive as notifications.
  const opening = useRef({ project, place, origin });
  const mode = preferences.outline;
  const { index } = project;

  // First document to show.
  useEffect(() => {
    const { project: opened, place: left, origin: self } = opening.current;
    const first = left?.documentId ?? opened.index.chapters[0]?.id ?? opened.index.fragments[0]?.id;
    if (first) {
      setCurrentId(first);
      return;
    }
    request("document.create", { kind: "chapter", title: "Capítulo primero", origin: self })
      .then((created) => setCurrentId(created.id))
      .catch((error: unknown) => setProblem(messageFor(error)));
  }, []);

  // If the open document went to the trash (here or in another window), show another one.
  const shownId =
    currentId && index.trash.some((entry) => entry.id === currentId)
      ? (index.chapters[0]?.id ?? index.fragments[0]?.id ?? null)
      : currentId;

  // Load the document whenever the writer picks another one.
  useEffect(() => {
    if (!shownId) return;
    let current = true;
    request("document.get", { id: shownId })
      .then((loaded) => {
        if (!current) return;
        setDocument(loaded);
        setWords(loaded.statistics.words);
      })
      .catch((error: unknown) => current && setProblem(messageFor(error)));
    return () => {
      current = false;
    };
  }, [shownId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOutlineShortcut(event)) return;
      event.preventDefault();
      setOutlineOpen((open) => !open);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // Opening the index takes the keyboard to it; closing gives it back to the text.
  const outlineWasOpen = useRef(outlineOpen);
  useEffect(() => {
    if (outlineWasOpen.current === outlineOpen) return;
    outlineWasOpen.current = outlineOpen;
    if (outlineOpen) {
      window.document
        .querySelector<HTMLElement>(".outline [aria-current=page], .outline .outline-open")
        ?.focus();
    } else {
      window.document.querySelector<HTMLElement>(".book-page .ProseMirror")?.focus();
    }
  }, [outlineOpen]);

  // A floating index steps aside as soon as the writer goes back to the text.
  const onFocusIn = (event: React.FocusEvent) => {
    if (mode !== "floating" || !outlineOpen) return;
    if (!(event.target as HTMLElement).closest(".outline")) setOutlineOpen(false);
  };

  const update = (changes: Parameters<typeof request<"preferences.update">>[1]["changes"]) =>
    void request("preferences.update", { changes, origin });

  const dismissDeleted = useCallback(() => setDeleted(null), []);

  const isEmpty = index.chapters.length === 0 && index.fragments.length === 0;
  const docked = outlineOpen && mode === "docked";

  return (
    <div className={`writing-view${docked ? " writing-view-docked" : ""}`} onFocus={onFocusIn}>
      <header className="writing-bar small-caps">
        <span className="writing-bar-start">
          <button
            type="button"
            className="action"
            aria-expanded={outlineOpen}
            title="Índice (Ctrl+Mayús+I)"
            onClick={() => setOutlineOpen((open) => !open)}
          >
            Índice
          </button>
          <span>
            {project.title}
            {words !== null && <span className="writing-count"> · {words} palabras</span>}
          </span>
        </span>
        <nav aria-label="Proyecto">
          <button
            className="action"
            onClick={() =>
              update({ theme: preferences.theme === "paper" ? "candlelight" : "paper" })
            }
          >
            {preferences.theme === "paper" ? "Luz de vela" : "Papel"}
          </button>
          <button
            className="action"
            aria-pressed={preferences.typewriterScrolling}
            onClick={() => update({ typewriterScrolling: !preferences.typewriterScrolling })}
          >
            Rodillo {preferences.typewriterScrolling ? "sí" : "no"}
          </button>
          <button className="action" onClick={() => void invoke("open_window")}>
            Otra ventana
          </button>
          <button
            className="action"
            onClick={() => void savePendingNow().then(() => request("project.close", { origin }))}
          >
            Cerrar proyecto
          </button>
        </nav>
      </header>

      {outlineOpen && (
        <Outline
          index={index}
          currentId={shownId}
          mode={mode}
          origin={origin}
          onOpen={setCurrentId}
          onModeChange={(outline) => update({ outline })}
          onClose={() => setOutlineOpen(false)}
          onDeleted={setDeleted}
          onProblem={setProblem}
        />
      )}

      <main className="writing-main">
        {problem && (
          <p className="writing-problem" role="alert">
            {problem}
          </p>
        )}
        {isEmpty && (
          <p className="writing-empty">
            La obra está vacía. Crea un capítulo o un fragmento desde el índice.
          </p>
        )}
        {document && document.id === shownId && (
          <BookEditor
            key={document.id}
            document={document}
            kind={
              index.fragments.some((entry) => entry.id === document.id) ? "fragment" : "chapter"
            }
            place={place?.documentId === document.id ? place : null}
            origin={origin}
            typewriterScrolling={preferences.typewriterScrolling}
            onWords={setWords}
            onProblem={setProblem}
          />
        )}
      </main>

      {deleted && (
        <UndoNotice
          key={deleted.id}
          message={`«${deleted.title}» está en la papelera.`}
          onUndo={() => {
            const entry = deleted;
            setDeleted(null);
            // If it was the one being written, it comes back to the page: it is still current.
            request("document.restore", { id: entry.id, origin }).catch((error: unknown) =>
              setProblem(messageFor(error)),
            );
          }}
          onDismiss={dismissDeleted}
        />
      )}
    </div>
  );
}

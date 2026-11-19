import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onNotification, request } from "../../bridge/core";
import type {
  DocumentEntry,
  DocumentKind,
  Statistics,
  TipTapDocument,
  VersionSummary,
  DocumentState,
  Place,
  Preferences,
  ProjectState,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { LogFolderButton } from "../../app/Trouble";
import { savePendingNow } from "../../editor/pending-saves";
import { isOutlineShortcut } from "../outline/shortcut";
import { Outline } from "../outline/Outline";
import { UndoNotice } from "../outline/UndoNotice";
import { Counter, type SaveState } from "../counter/Counter";
import { Versions } from "../versions/Versions";
import { VersionView } from "../versions/VersionView";
import { isSaveVersionShortcut, isVersionsShortcut } from "../versions/shortcuts";
import { BookEditor } from "./BookEditor";
import "./writing-view.css";

/** A version shown in place of the page, with the text it is compared with. */
interface Viewing {
  version: VersionSummary;
  content: TipTapDocument;
  current: TipTapDocument;
}

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
  const [counts, setCounts] = useState<{ id: string; statistics: Statistics } | null>(null);
  // Saves bring the counts of the work; a change to the index brings a new project with them.
  const [work, setWork] = useState({ value: project.work, base: project.work });
  const projectWork = useRef(project.work);
  useEffect(() => {
    projectWork.current = project.work;
  }, [project.work]);
  const [save, setSave] = useState<SaveState>({ kind: "saved" });
  const [problem, setProblem] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(preferences.outline === "docked");
  const [deleted, setDeleted] = useState<DocumentEntry | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [nameRequest, setNameRequest] = useState(0);
  const [viewing, setViewing] = useState<Viewing | null>(null);
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
        setCounts({ id: loaded.id, statistics: loaded.statistics });
      })
      .catch((error: unknown) => current && setProblem(messageFor(error)));
    return () => {
      current = false;
    };
  }, [shownId]);

  // What other windows write changes the counts of the work.
  useEffect(() => {
    const unlisten = onNotification("document.changed", (change) =>
      setWork({ value: change.work, base: projectWork.current }),
    );
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);

  // Closing the window waits for what was just typed to be saved.
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(() => savePendingNow());
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isOutlineShortcut(event)) {
        event.preventDefault();
        setOutlineOpen((open) => !open);
      } else if (isVersionsShortcut(event)) {
        event.preventDefault();
        setVersionsOpen((open) => !open);
      } else if (isSaveVersionShortcut(event)) {
        event.preventDefault();
        setVersionsOpen(true);
        setNameRequest((asked) => asked + 1);
      }
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

  async function lookAt(version: VersionSummary) {
    try {
      // Compared with what is on the page now, the last words included.
      await savePendingNow();
      const [kept, now] = await Promise.all([
        request("version.get", { id: version.id }),
        request("document.get", { id: version.documentId }),
      ]);
      setViewing({ version, content: kept.content, current: now.content });
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function restore(version: VersionSummary) {
    try {
      await savePendingNow();
      const restored = await request("version.restore", { id: version.id, origin });
      setViewing(null);
      setDocument(restored.document);
      setCounts({ id: restored.document.id, statistics: restored.document.statistics });
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  function closeVersions() {
    setVersionsOpen(false);
    setViewing(null);
    window.document.querySelector<HTMLElement>(".book-page .ProseMirror")?.focus();
  }
  // Typing reports itself on every key; the view only changes when the state does.
  const onSaveState = useCallback(
    (next: SaveState) =>
      setSave((current) => (current.kind === next.kind && next.kind !== "failed" ? current : next)),
    [],
  );

  const kindOf = (id: string | null): DocumentKind =>
    index.fragments.some((entry) => entry.id === id) ? "fragment" : "chapter";

  const titleOf = (id: string) =>
    [...index.chapters, ...index.fragments].find((entry) => entry.id === id)?.title ?? "";
  // A version belongs to one document: switching documents leaves it.
  const shownViewing = viewing && viewing.version.documentId === shownId ? viewing : null;

  const isEmpty = index.chapters.length === 0 && index.fragments.length === 0;
  const docked = outlineOpen && mode === "docked";

  return (
    <div
      className={`writing-view${docked ? " writing-view-docked" : ""}${
        versionsOpen ? " writing-view-versions" : ""
      }`}
      onFocus={onFocusIn}
    >
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
          <span>{project.title}</span>
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
          <button
            className="action"
            aria-pressed={preferences.counterVisible}
            onClick={() => update({ counterVisible: !preferences.counterVisible })}
          >
            Contador {preferences.counterVisible ? "sí" : "no"}
          </button>
          <button
            className="action"
            aria-expanded={versionsOpen}
            title="Versiones (F6)"
            onClick={() => (versionsOpen ? closeVersions() : setVersionsOpen(true))}
          >
            Versiones
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
            {problem} <LogFolderButton />
          </p>
        )}
        {isEmpty && (
          <p className="writing-empty">
            La obra está vacía. Crea un capítulo o un fragmento desde el índice.
          </p>
        )}
        {shownViewing && (
          <VersionView
            key={shownViewing.version.id}
            version={shownViewing.version}
            content={shownViewing.content}
            current={shownViewing.current}
            onRestore={() => void restore(shownViewing.version)}
            onBack={() => {
              setViewing(null);
              window.document.querySelector<HTMLElement>(".book-page .ProseMirror")?.focus();
            }}
          />
        )}
        {document && document.id === shownId && (
          <div hidden={!!shownViewing}>
            <BookEditor
              key={`${document.id}:${document.revision}`}
              document={document}
              kind={kindOf(document.id)}
              place={place?.documentId === document.id ? place : null}
              origin={origin}
              typewriterScrolling={preferences.typewriterScrolling}
              onCounts={(statistics, total) => {
                setCounts({ id: document.id, statistics });
                setWork({ value: total, base: project.work });
              }}
              onSaveState={onSaveState}
              onProblem={setProblem}
            />
          </div>
        )}
      </main>

      {versionsOpen && shownId && (
        <Versions
          documentId={shownId}
          title={titleOf(shownId)}
          origin={origin}
          selectedId={shownViewing?.version.id ?? null}
          nameRequest={nameRequest}
          onSelect={(version) => void lookAt(version)}
          onClose={closeVersions}
          onProblem={setProblem}
        />
      )}

      <Counter
        document={counts && counts.id === shownId ? counts.statistics : null}
        kind={kindOf(shownId)}
        work={work.base === project.work ? work.value : project.work}
        chapters={index.chapters.length}
        save={save}
        visible={preferences.counterVisible}
        onHide={() => update({ counterVisible: false })}
      />

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

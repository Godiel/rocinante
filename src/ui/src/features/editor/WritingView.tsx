import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onNotification, request } from "../../bridge/core";
import type {
  DocumentEntry,
  Note,
  DocumentKind,
  Statistics,
  TipTapDocument,
  VersionSummary,
  DocumentState,
  Place,
  Preferences,
  ProjectState,
  OwnAmbience,
} from "../../bridge/generated/protocol";
import type { Pickers } from "../welcome/Welcome";
import { messageFor } from "../../app/messages";
import { LogFolderButton } from "../../app/Trouble";
import { keepsItsOwnKeys } from "../../editor/own-keys";
import { savePendingNow } from "../../editor/pending-saves";
import { isOutlineShortcut } from "../outline/shortcut";
import { Outline } from "../outline/Outline";
import { UndoNotice } from "../outline/UndoNotice";
import { Counter, type SaveState } from "../counter/Counter";
import { Versions } from "../versions/Versions";
import { VersionView } from "../versions/VersionView";
import { isSaveVersionShortcut, isVersionsShortcut } from "../versions/shortcuts";
import { BookEditor } from "./BookEditor";
import { FormatSheet } from "../format/FormatSheet";
import { PageView } from "../pages/PageView";
import { isPageViewShortcut } from "../pages/shortcuts";
import { workClasses, workStyle } from "../format/work-style";
import { FocusBar } from "../focus/FocusBar";
import { tauriWindow } from "../focus/focus-window";
import { useFocusMode } from "../focus/useFocusMode";
import { useSessionGoal, type Session } from "../focus/useSessionGoal";
import { GoalMeter, GoalReached } from "../focus/Goal";
import { AmbienceSheet } from "../ambience/AmbienceSheet";
import { ElementsPanel } from "../elements/ElementsPanel";
import { suggestedAttributes } from "../elements/kinds";
import { isElementsShortcut } from "../elements/panel";
import { NotesPanel, type OpenedNote } from "../notes/NotesPanel";
import { useNoteTrash } from "../notes/useNoteTrash";
import { SidePanelTabs } from "../workspace/SidePanelTabs";
import {
  isNotesShortcut,
  rememberedSidePanel,
  rememberSidePanel,
  type SideTab,
} from "../workspace/side-panel";
import { useBoard } from "../elements/useBoard";
import { notesOf } from "../notes/notes-list";
import { useWorkNotes } from "../notes/useWorkNotes";
import { useElementTrash } from "../elements/useElementTrash";
import { backdropOf, backdrops, paintOf } from "../ambience/catalog";
import { sheetColour } from "../ambience/sheet";
import { ambienceUrl } from "../ambience/own-url";
import { AnimatedBackdrop } from "../ambience/animated/AnimatedBackdrop";
import { sounds } from "../../audio/engine";
import { ambientSounds, tracksOf } from "../../audio/ambient-sounds";
import { WorkspaceTabs } from "../workspace/WorkspaceTabs";
import { panelId, tabId } from "../workspace/tabs";
import { useWorkspaceTab } from "../workspace/useWorkspaceTab";
import "./writing-view.css";

// The board brings React Flow with it: it is loaded the first time the writer opens it.
const BoardTab = lazy(() => import("../board/BoardTab"));

/** Gives the keyboard back to the text, where the cursor was. */
function focusText() {
  window.document
    .querySelector<HTMLElement>(".book-page .ProseMirror")
    ?.focus({ preventScroll: true });
}

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
  /** The images and sounds the writer added. */
  ownAmbience: OwnAmbience[];
  pickers: Pickers;
  origin: string;
}

/**
 * The open project: the index on one side and the chapter or fragment being written. It opens
 * where the writer left off, or on the first chapter.
 */
export function WritingView({
  project,
  place,
  preferences,
  ownAmbience,
  pickers,
  origin,
}: WritingViewProps) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [counts, setCounts] = useState<{ id: string; statistics: Statistics } | null>(null);
  // Saves bring the counts of the work; a change to the index brings a new project with them.
  const [work, setWork] = useState({ value: project.work, base: project.work });
  const workCounts = work.base === project.work ? work.value : project.work;
  // A session of focus mode, for its goal: it starts and ends with the mode.
  const [session, setSession] = useState<Session | null>(null);
  const projectWork = useRef(project.work);
  useEffect(() => {
    projectWork.current = project.work;
  }, [project.work]);
  const [save, setSave] = useState<SaveState>({ kind: "saved" });
  const [problem, setProblem] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(preferences.outline === "docked");
  const [deleted, setDeleted] = useState<DocumentEntry | null>(null);
  // One sheet at a time on the right of the text: the fichas or the notes (two tabs of one panel), the
  // versions, the format or the ambience. Whether the panel was open, and at which tab, is kept for this window.
  const [sheet, setSheet] = useState<SideTab | "versions" | "format" | "ambience" | null>(
    rememberedSidePanel,
  );
  const elementsOpen = sheet === "elements";
  const sideTab: SideTab | null = sheet === "elements" || sheet === "notes" ? sheet : null;
  const lastSideTab = useRef<SideTab>(sideTab ?? "elements");
  useEffect(() => {
    if (sideTab) lastSideTab.current = sideTab;
  }, [sideTab]);
  const { board, loaded: boardLoaded } = useBoard(project.id);
  const { notes: workNotes, loaded: notesLoaded } = useWorkNotes(project.id);
  const [openNote, setOpenNote] = useState<OpenedNote | null>(null);
  // The note whose passage the writer asked to see; `at` tells one request from the next.
  const [reveal, setReveal] = useState<{ noteId: string; documentId: string; at: number } | null>(
    null,
  );
  const noteTrash = useNoteTrash(origin, setProblem);
  const [openElement, setOpenElement] = useState<string | null>(null);
  const [freshElement, setFreshElement] = useState<{
    id: string;
    field: "name" | "kind";
  } | null>(null);
  const [searchRequest, setSearchRequest] = useState(0);
  const elementTrash = useElementTrash(origin, setProblem);
  const versionsOpen = sheet === "versions";
  const [pagesOpen, setPagesOpen] = useState(false);
  const [nameRequest, setNameRequest] = useState(0);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // The project and place only matter when the view opens; later changes arrive as notifications.
  const opening = useRef({ project, place, origin });
  const mode = preferences.outline;
  const { index } = project;
  const [screen] = useState(tauriWindow);
  // Whether focus mode is on, for the shortcuts, which are bound once.
  const focusedRef = useRef(false);
  // Whether the board shows, for the same shortcuts: those of the text wait for it.
  const onBoardRef = useRef(false);
  // What focus mode put away, to bring it back on leaving.
  const putAway = useRef<{ outline: boolean; sheet: typeof sheet }>({
    outline: false,
    sheet: null,
  });

  useEffect(() => rememberSidePanel(sideTab), [sideTab]);

  // The fichas open with the keyboard in their search, and give it back to the text on closing. The
  // shortcut of the tab that shows closes the panel; the other changes tab.
  const toggleSide = useCallback((tab: SideTab) => {
    setViewing(null);
    setSheet((open) => (open === tab ? null : tab));
    if (tab === "elements") setSearchRequest((asked) => asked + 1);
    focusText();
  }, []);
  const toggleElements = useCallback(() => toggleSide("elements"), [toggleSide]);
  const toggleNotes = useCallback(() => toggleSide("notes"), [toggleSide]);
  // The button of the bar opens the panel where it was last, and closes it.
  const toggleSidePanel = () => toggleSide(sideTab ?? lastSideTab.current);

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
  const noteDocuments = useMemo(
    () => [...index.chapters, ...index.fragments].map(({ id, title }) => ({ id, title })),
    [index],
  );
  const documentNotes = useMemo(
    () => (shownId ? notesOf(workNotes, shownId) : []),
    [workNotes, shownId],
  );
  const shownRef = useRef(shownId);
  useEffect(() => {
    shownRef.current = shownId;
  }, [shownId]);

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

  // The typing sounds as the writer set them, in this window and as other windows change them.
  const typing = preferences.ambience.typing;
  useEffect(() => sounds.setTyping(typing), [typing]);

  // The ambient sounds play in the main window only: each window has its own audio, and two
  // would play the rain twice. They fade away when the work closes.
  const allAmbients = useMemo(() => ambientSounds(ownAmbience, ambienceUrl), [ownAmbience]);
  const { ambients, ambientVolume, ambientMuted } = preferences.ambience;
  const playsAmbients = origin === "main";
  useEffect(() => {
    if (playsAmbients)
      sounds.setAmbients(tracksOf(ambients, allAmbients), ambientVolume, ambientMuted);
  }, [playsAmbients, ambients, allAmbients, ambientVolume, ambientMuted]);
  useEffect(() => () => sounds.stopAmbients(), []);
  // A sound of the writer's that starts right but does not decode is said, and left silent.
  useEffect(
    () =>
      sounds.onUnplayable((id) => {
        const name = allAmbients.find((sound) => sound.id === id)?.name ?? "ese sonido";
        setProblem(
          `No se puede reproducir «${name}». Puede que el archivo esté dañado o en un formato que este equipo no reproduce.`,
        );
      }),
    [allAmbients],
  );

  // Browsers start sound only after the writer does something: the first key or click wakes it.
  useEffect(() => {
    const wake = () => sounds.wake();
    window.addEventListener("pointerdown", wake, { capture: true });
    window.addEventListener("keydown", wake, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", wake, { capture: true });
      window.removeEventListener("keydown", wake, { capture: true });
    };
  }, []);

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
      if (keepsItsOwnKeys(event.target)) return;
      if (onBoardRef.current) {
        // The shortcuts of the text wait for the writer to come back to it; F5 does not reload either.
        if (
          isPageViewShortcut(event) ||
          isOutlineShortcut(event) ||
          isVersionsShortcut(event) ||
          isSaveVersionShortcut(event) ||
          isElementsShortcut(event) ||
          isNotesShortcut(event)
        ) {
          event.preventDefault();
        }
        return;
      }
      if (focusedRef.current) {
        // In focus mode the big views stay away; a version is still kept, without the sheet.
        if (isSaveVersionShortcut(event)) {
          event.preventDefault();
          const documentId = shownRef.current;
          if (documentId) {
            void savePendingNow()
              .then(() => request("version.create", { documentId, name: null, origin: self }))
              .catch((error: unknown) => setProblem(messageFor(error)));
          }
        } else if (
          isPageViewShortcut(event) ||
          isOutlineShortcut(event) ||
          isVersionsShortcut(event) ||
          isElementsShortcut(event) ||
          isNotesShortcut(event)
        ) {
          event.preventDefault();
        }
        return;
      }
      if (isPageViewShortcut(event)) {
        // In a browser F5 reloads the page: here it is the page view.
        event.preventDefault();
        setPagesOpen((open) => !open);
      } else if (isOutlineShortcut(event)) {
        event.preventDefault();
        setOutlineOpen((open) => !open);
      } else if (isElementsShortcut(event)) {
        event.preventDefault();
        toggleElements();
      } else if (isNotesShortcut(event)) {
        event.preventDefault();
        toggleNotes();
      } else if (isVersionsShortcut(event)) {
        event.preventDefault();
        setSheet((open) => (open === "versions" ? null : "versions"));
      } else if (isSaveVersionShortcut(event)) {
        event.preventDefault();
        setSheet("versions");
        setNameRequest((asked) => asked + 1);
      }
    };
    const self = opening.current.origin;
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [toggleElements, toggleNotes]);

  // «Ir al pasaje», from a note or from a ficha: its chapter opens and the passage is selected.
  const goToPassage = (note: Note) => {
    if (!note.documentId) return;
    setViewing(null);
    setCurrentId(note.documentId);
    const documentId = note.documentId;
    setReveal((last) => ({ noteId: note.id, documentId, at: (last?.at ?? 0) + 1 }));
  };

  async function createElement(name: string | null) {
    try {
      const created = await request("element.create", {
        kind: "character",
        name: name ?? "Ficha nueva",
        attributes: suggestedAttributes("character"),
        origin,
      });
      setViewing(null);
      setSheet("elements");
      setOpenElement(created.id);
      // From the text the name is already right: what is left is to say what it is.
      setFreshElement({ id: created.id, field: name === null ? "name" : "kind" });
      setProblem(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

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

  // Focus mode puts away the index and the sheets, and brings them back as they were. The text
  // keeps the keyboard, so the cursor stays where it was.
  const focus = useFocusMode({
    window: screen,
    onEnter: () => {
      // Focus mode is for the text: from the board it goes back to it.
      workspace.show("writing");
      putAway.current = { outline: outlineOpen, sheet };
      outlineWasOpen.current = false;
      setOutlineOpen(false);
      setSheet(null);
      setViewing(null);
      setPagesOpen(false);
      setSession({ words: workCounts.words });
      focusText();
    },
    onLeave: () => {
      setSession(null);
      outlineWasOpen.current = putAway.current.outline;
      setOutlineOpen(putAway.current.outline);
      setSheet(putAway.current.sheet);
      focusText();
    },
    onProblem: (error) => setProblem(messageFor(error)),
  });
  useEffect(() => {
    focusedRef.current = focus.focused;
  }, [focus.focused]);

  const workspace = useWorkspaceTab({ focused: focus.focused, onBackToWriting: focusText });
  const onBoard = workspace.tab === "board";
  useEffect(() => {
    onBoardRef.current = onBoard;
  }, [onBoard]);

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

  function closePages() {
    setPagesOpen(false);
    window.document.querySelector<HTMLElement>(".book-page .ProseMirror")?.focus();
  }

  function openSheet(which: "format" | "ambience") {
    setViewing(null);
    setSheet(which);
  }

  function closeSheet() {
    setSheet(null);
    window.document.querySelector<HTMLElement>(".book-page .ProseMirror")?.focus();
  }

  function closeVersions() {
    setSheet(null);
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
  const progress = useSessionGoal(session, preferences.ambience.goal, workCounts.words);
  const dimming = focus.focused && preferences.ambience.dimOthers;
  // In focus mode the chosen background shows behind translucent paper.
  const allBackdrops = useMemo(() => backdrops(ownAmbience, ambienceUrl), [ownAmbience]);
  const backdrop = focus.focused ? backdropOf(preferences.ambience.background, allBackdrops) : null;
  const paint = backdrop ? paintOf(backdrop, preferences.theme) : null;
  const toggleAmbience = () => (sheet === "ambience" ? closeSheet() : openSheet("ambience"));
  const docked = outlineOpen && mode === "docked";

  return (
    <div
      className={`writing-view ${workClasses(project.format)}${
        docked ? " writing-view-docked" : ""
      }${sheet ? " writing-view-sheet" : ""}${focus.focused ? " writing-view-focus" : ""}${paint ? " writing-view-backdrop" : ""}${dimming ? " writing-view-dim" : ""}`}
      style={
        {
          ...workStyle(project.format),
          "--sheet-colour": sheetColour(preferences.theme),
        } as React.CSSProperties
      }
      onFocus={onFocusIn}
    >
      <header className="writing-bar small-caps">
        <span className="writing-bar-start">
          {!onBoard && (
            <button
              type="button"
              className="action"
              aria-expanded={outlineOpen}
              title="Índice (Ctrl+Mayús+I)"
              onClick={() => setOutlineOpen((open) => !open)}
            >
              Índice
            </button>
          )}
          <span className="writing-bar-title">{project.title}</span>
          {!focus.focused && <WorkspaceTabs tab={workspace.tab} onShow={workspace.show} />}
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
          {!onBoard && (
            <>
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
                aria-expanded={sideTab !== null}
                title="Fichas (Ctrl+Mayús+E) y notas (Ctrl+Mayús+N)"
                onClick={toggleSidePanel}
              >
                Fichas
              </button>
              <button
                className="action"
                aria-expanded={sheet === "ambience"}
                onClick={toggleAmbience}
              >
                Ambiente
              </button>
              <button className="action" title="Modo concentración (F11)" onClick={focus.enter}>
                Concentración
              </button>
              <button
                className="action"
                aria-pressed={pagesOpen}
                title="Vista de página (F5)"
                onClick={() => (pagesOpen ? closePages() : setPagesOpen(true))}
              >
                Páginas
              </button>
              <button
                className="action"
                aria-expanded={sheet === "format"}
                onClick={() => (sheet === "format" ? closeSheet() : openSheet("format"))}
              >
                Formato
              </button>
              <button
                className="action"
                aria-expanded={versionsOpen}
                title="Versiones (F6)"
                onClick={() => (versionsOpen ? closeVersions() : setSheet("versions"))}
              >
                Versiones
              </button>
            </>
          )}
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

      <div
        className="workspace-writing"
        id={panelId("writing")}
        role="tabpanel"
        aria-labelledby={tabId("writing")}
        hidden={onBoard}
      >
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

        {paint && <div className="focus-backdrop" style={{ background: paint }} />}
        {backdrop?.kind === "animated" && (
          <AnimatedBackdrop scene={backdrop.scene} theme={preferences.theme} />
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
                notes={documentNotes}
                notesLoaded={notesLoaded}
                reveal={reveal?.documentId === document.id ? reveal : null}
                onOpenNote={(id) => {
                  setSheet("notes");
                  setOpenNote({ id });
                }}
                onDeleteNote={(id) => void noteTrash.remove(id)}
                typewriterScrolling={preferences.typewriterScrolling}
                onCounts={(statistics, total) => {
                  setCounts({ id: document.id, statistics });
                  setWork({ value: total, base: project.work });
                }}
                onSaveState={onSaveState}
                onProblem={setProblem}
                onCreateElement={(name) => void createElement(name)}
              />
            </div>
          )}
        </main>

        {pagesOpen && (
          <PageView format={project.format} onClose={closePages} onProblem={setProblem} />
        )}

        {elementsOpen && (
          <ElementsPanel
            board={board}
            loaded={boardLoaded}
            openId={openElement}
            fresh={freshElement}
            origin={origin}
            searchRequest={searchRequest}
            chooseImage={pickers.chooseElementImage}
            onOpen={(id) => {
              setOpenElement(id);
              setFreshElement(null);
            }}
            onCreate={() => void createElement(null)}
            onClose={closeSheet}
            onProblem={setProblem}
            onTrash={(id, name) => {
              setOpenElement(null);
              void elementTrash.trash(id, name);
            }}
            onRestore={(id) => void elementTrash.restore(id)}
            tabs={<SidePanelTabs tab="elements" onShow={(tab) => setSheet(tab)} />}
            notes={{
              all: workNotes,
              onOpen: (id) => {
                setSheet("notes");
                setOpenNote({ id });
              },
              onGoToPassage: goToPassage,
              onNew: (elementId) => {
                setSheet("notes");
                setOpenNote({ draft: true, elements: [elementId] });
              },
            }}
          />
        )}

        {sheet === "notes" && (
          <NotesPanel
            notes={workNotes}
            loaded={notesLoaded}
            documents={noteDocuments}
            currentDocumentId={shownId}
            elements={board.elements}
            origin={origin}
            opened={openNote}
            tabs={<SidePanelTabs tab="notes" onShow={(tab) => setSheet(tab)} />}
            onOpen={setOpenNote}
            onGoToPassage={goToPassage}
            onDelete={(note) => void noteTrash.remove(note.id)}
            onOpenElement={(id) => {
              setSheet("elements");
              setOpenElement(id);
              setFreshElement(null);
            }}
            onClose={closeSheet}
            onProblem={setProblem}
          />
        )}

        {sheet === "format" && (
          <FormatSheet
            format={project.format}
            title={project.title}
            origin={origin}
            onClose={closeSheet}
            onProblem={setProblem}
          />
        )}

        {sheet === "ambience" && (
          <AmbienceSheet
            ambience={preferences.ambience}
            backdrops={allBackdrops}
            ambients={allAmbients}
            playsAmbients={playsAmbients}
            pickers={pickers}
            theme={preferences.theme}
            origin={origin}
            onClose={closeSheet}
            onProblem={setProblem}
          />
        )}

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

        {focus.focused && (
          <FocusBar
            words={counts && counts.id === shownId ? counts.statistics.words : 0}
            onLeave={focus.leave}
          >
            {progress && <GoalMeter progress={progress} />}
            <button
              type="button"
              className="action"
              aria-expanded={sheet === "ambience"}
              onClick={toggleAmbience}
            >
              Ambiente
            </button>
          </FocusBar>
        )}

        {session && progress && <GoalReached session={session} progress={progress} />}

        <Counter
          document={counts && counts.id === shownId ? counts.statistics : null}
          kind={kindOf(shownId)}
          work={workCounts}
          chapters={index.chapters.length}
          save={save}
          visible={preferences.counterVisible}
          onHide={() => update({ counterVisible: false })}
        />

        {!deleted && (noteTrash.notice ?? elementTrash.notice)}
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

      {workspace.boardVisited && (
        <div
          id={panelId("board")}
          role="tabpanel"
          aria-labelledby={tabId("board")}
          hidden={!onBoard}
        >
          <Suspense fallback={null}>
            <BoardTab
              board={board}
              loaded={boardLoaded}
              origin={origin}
              chooseImage={pickers.chooseElementImage}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

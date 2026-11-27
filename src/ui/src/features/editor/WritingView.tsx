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
import { WRITE_AT_END } from "./write-at-end";
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
import { SquirePanel } from "../squire/SquirePanel";
import { ProposalList } from "../squire/ProposalList";
import { useSquire } from "../squire/useSquire";
import {
  isNotesShortcut,
  rememberedSidePanel,
  rememberSidePanel,
  type SideTab,
} from "../workspace/side-panel";
import { useBoard } from "../elements/useBoard";
import { notesOf } from "../notes/notes-list";
import { useWorkNotes } from "../notes/useWorkNotes";
import { mentionIndex } from "../mentions/find-mentions";
import { acceptedWords, spellChecker } from "../correction/spelling";
import { useDictionary } from "../correction/useDictionary";
import { isCorrectionShortcut } from "../correction/shortcuts";
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
import { useThreads } from "../threads/useThreads";
import { MilestoneSlip } from "../threads/MilestoneSlip";
import { ExportDialog } from "../export/ExportDialog";
import { ShortcutsDialog } from "../shortcuts/ShortcutsDialog";
import { isHelpShortcut } from "../shortcuts/table";
import { BarActions } from "../workspace/BarActions";
import { UpdateDialog } from "../updates/UpdateDialog";
import { useUpdate } from "../updates/useUpdate";
import { isExportShortcut } from "../export/shortcuts";
import { useDetachedBoard } from "../workspace/board-window";
import "./writing-view.css";

// The board brings React Flow with it: it is loaded the first time the writer opens it.
const BoardTab = lazy(() => import("../board/BoardTab"));
const loadThreadsTab = () => import("../threads/ThreadsTab");
const ThreadsTab = lazy(() => loadThreadsTab().then((module) => ({ default: module.ThreadsTab })));

/** Gives the keyboard back to the text, where the cursor was. */
function focusText() {
  window.document
    .querySelector<HTMLElement>(".book-page .ProseMirror")
    ?.focus({ preventScroll: true });
}

/**
 * A click on the sheet that is not on the text, a control or a panel takes the cursor to the end of the text:
 * an empty chapter, or the paper below a short one, is somewhere to write too.
 */
function writeWhereClicked(event: React.MouseEvent) {
  const target = event.target as HTMLElement;
  if (
    target.closest(
      ".ProseMirror, button, a, input, textarea, select, label, [role=dialog], [contenteditable]",
    )
  )
    return;
  if (!window.document.querySelector(".book-page .ProseMirror")) return;
  event.preventDefault();
  window.dispatchEvent(new Event(WRITE_AT_END));
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
  const sideTab: SideTab | null =
    sheet === "elements" || sheet === "notes" || sheet === "squire" ? sheet : null;
  const lastSideTab = useRef<SideTab>(sideTab ?? "elements");
  useEffect(() => {
    if (sideTab) lastSideTab.current = sideTab;
  }, [sideTab]);
  const { board, loaded: boardLoaded } = useBoard(project.id);
  // A mention the writer asked to see from «En el texto»; `at` tells one request from the next.
  const [revealMention, setRevealMention] = useState<{
    elementId: string;
    documentId: string;
    ordinal: number;
    at: number;
  } | null>(null);
  // The names of the fichas, looked for in the text: worked out again only when a name changes.
  const namesKey = JSON.stringify(
    board.elements.map((element) => [element.id, element.name, element.aliases]),
  );
  const mentions = useMemo(
    () =>
      mentionIndex(
        (JSON.parse(namesKey) as [string, string, string[]][]).map(([id, name, aliases]) => ({
          id,
          name,
          aliases,
        })),
      ),
    [namesKey],
  );
  // The correction: the writer's own dictionary, the words ignored this session and the names of the fichas
  // are accepted; the speller is shared by every editor of the window.
  const dictionary = useDictionary();
  const [ignored, setIgnored] = useState<readonly string[]>([]);
  const correction = useMemo(
    () => ({
      checker: spellChecker(),
      accepted: acceptedWords(
        [...dictionary, ...ignored],
        (JSON.parse(namesKey) as [string, string, string[]][]).flatMap(([, name, aliases]) => [
          name,
          ...aliases,
        ]),
      ),
    }),
    [dictionary, ignored, namesKey],
  );

  const { notes: workNotes, loaded: notesLoaded } = useWorkNotes(project.id);
  const squire = useSquire(project.id);
  // The passage of a proposal the writer asked to see; `at` tells one request from the next.
  const [revealPassage, setRevealPassage] = useState<{
    documentId: string;
    text: string;
    at: number;
  } | null>(null);
  const [openNote, setOpenNote] = useState<OpenedNote | null>(null);
  const [exporting, setExporting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateLater, setUpdateLater] = useState(false);
  // The paragraph where the writer is marking a milestone, from the floating menu.
  const [marking, setMarking] = useState<{ paragraph: string; documentId: string } | null>(null);
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
  // F7 shows and hides the marks of the correction; the handler of the keys reads the latest preference.
  const correctionVisibleRef = useRef(preferences.correctionVisible);
  useEffect(() => {
    correctionVisibleRef.current = preferences.correctionVisible;
  }, [preferences.correctionVisible]);
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
      // The export is of the whole work: from the text, the board or the threads, but not in focus mode.
      if (isHelpShortcut(event)) {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }
      if (isExportShortcut(event)) {
        event.preventDefault();
        if (!focusedRef.current) setExporting(true);
        return;
      }
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
      if (isCorrectionShortcut(event)) {
        event.preventDefault();
        void request("preferences.update", {
          changes: { correctionVisible: !correctionVisibleRef.current },
          origin: self,
        });
      } else if (isPageViewShortcut(event)) {
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
  // On the board or the threads, the text waits, hidden, with its shortcuts.
  const awayFromText = workspace.tab !== "writing";
  const threads = useThreads(project.id, workspace.tab === "threads");
  const available = useUpdate(preferences.checkForUpdates);
  // The threads are fetched ahead, once the work is open and the writer pauses, so F8 does not wait for them.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadThreadsTab().catch(() => {}), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  // The board may live in a window of its own; when it comes back, it shows here.
  const showBoard = workspace.show;
  const boardHome = useDetachedBoard(useCallback(() => showBoard("board"), [showBoard]));
  const separateBoard = () => {
    void invoke("open_window", { board: true });
    workspace.show("writing");
  };
  useEffect(() => {
    onBoardRef.current = awayFromText;
  }, [awayFromText]);

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
          {!awayFromText && (
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
        <BarActions
          items={[
            ...(available && !updateLater
              ? [
                  {
                    id: "update",
                    label: `Versión ${available.version} disponible`,
                    className: "update-notice",
                    priority: "bar" as const,
                    onSelect: () => setUpdateOpen(true),
                  },
                ]
              : []),
            ...(onBoard && !boardHome.detached
              ? [
                  {
                    id: "separate",
                    label: "Separar",
                    title: "Abrir el Tablero en su propia ventana",
                    priority: "bar" as const,
                    onSelect: separateBoard,
                  },
                ]
              : []),
            ...(!awayFromText
              ? [
                  {
                    id: "ambience",
                    label: "Ambiente",
                    expanded: sheet === "ambience",
                    priority: 6,
                    onSelect: toggleAmbience,
                  },
                  {
                    id: "focus",
                    label: "Concentración",
                    title: "Modo concentración (F11)",
                    priority: 5,
                    onSelect: focus.enter,
                  },
                  {
                    id: "pages",
                    label: "Páginas",
                    title: "Vista de página (F5)",
                    pressed: pagesOpen,
                    priority: 9,
                    onSelect: () => (pagesOpen ? closePages() : setPagesOpen(true)),
                  },
                  {
                    id: "format",
                    label: "Formato",
                    expanded: sheet === "format",
                    priority: 7,
                    onSelect: () => (sheet === "format" ? closeSheet() : openSheet("format")),
                  },
                  {
                    id: "versions",
                    label: "Versiones",
                    title: "Versiones (F6)",
                    expanded: versionsOpen,
                    priority: 8,
                    onSelect: () => (versionsOpen ? closeVersions() : setSheet("versions")),
                  },
                ]
              : []),
            {
              id: "window",
              label: "Otra ventana",
              priority: 1,
              onSelect: () => void invoke("open_window"),
            },
            {
              id: "theme",
              label: preferences.theme === "paper" ? "Luz de vela" : "Papel",
              priority: 4,
              onSelect: () =>
                update({ theme: preferences.theme === "paper" ? "candlelight" : "paper" }),
            },
            ...(!awayFromText
              ? [
                  {
                    id: "typewriter",
                    label: `Rodillo ${preferences.typewriterScrolling ? "sí" : "no"}`,
                    pressed: preferences.typewriterScrolling,
                    priority: 3,
                    onSelect: () =>
                      update({ typewriterScrolling: !preferences.typewriterScrolling }),
                  },
                  {
                    id: "counter",
                    label: `Contador ${preferences.counterVisible ? "sí" : "no"}`,
                    pressed: preferences.counterVisible,
                    priority: 2,
                    onSelect: () => update({ counterVisible: !preferences.counterVisible }),
                  },
                  {
                    id: "elements",
                    label: "Fichas",
                    title: "Fichas (Ctrl+Mayús+E) y notas (Ctrl+Mayús+N)",
                    expanded: sideTab !== null,
                    priority: "bar" as const,
                    onSelect: toggleSidePanel,
                  },
                  {
                    id: "squire",
                    label:
                      squire.settings.pending > 0
                        ? `Escudero · ${squire.settings.pending}`
                        : "Escudero",
                    title: "Escudero: propuestas y ajustes",
                    expanded: sheet === "squire",
                    priority: "bar" as const,
                    onSelect: () => toggleSide("squire"),
                  },
                ]
              : []),
            {
              id: "export",
              label: "Exportar",
              title: "Exportar la obra (F9)",
              priority: "bar",
              onSelect: () => setExporting(true),
            },
            {
              id: "shortcuts",
              label: "Teclas rápidas",
              title: "Teclas rápidas (F1)",
              priority: "menu",
              onSelect: () => setHelpOpen(true),
            },
            {
              id: "close",
              label: "Cerrar proyecto",
              priority: "menu",
              onSelect: () =>
                void savePendingNow().then(() => request("project.close", { origin })),
            },
          ]}
        />
      </header>

      <div
        className="workspace-writing"
        id={panelId("writing")}
        role="tabpanel"
        aria-labelledby={tabId("writing")}
        hidden={awayFromText}
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

        <main className="writing-main" onMouseDown={writeWhereClicked}>
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
                correction={correction}
                correctionVisible={preferences.correctionVisible && !focus.focused}
                onAddWord={(word) =>
                  void request("dictionary.add", { word, origin }).catch((error: unknown) =>
                    setProblem(messageFor(error)),
                  )
                }
                onIgnoreWord={(word) => setIgnored((words) => [...words, word])}
                mentionIndex={mentions}
                revealMention={revealMention?.documentId === document.id ? revealMention : null}
                mentionElements={board.elements}
                onOpenElement={(id) => {
                  setViewing(null);
                  setSheet("elements");
                  setOpenElement(id);
                  setFreshElement(null);
                }}
                mentionsVisible={preferences.mentionsVisible && !focus.focused}
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
                revealPassage={revealPassage?.documentId === document.id ? revealPassage : null}
                onMarkMilestone={(paragraph) => setMarking({ paragraph, documentId: document.id })}
                onParagraphDone={
                  squire.settings.enabled
                    ? (text) =>
                        void request("squire.analyze", {
                          documentId: document.id,
                          text,
                          origin,
                        }).catch(() => {})
                    : undefined
                }
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
            tabs={
              <SidePanelTabs
                tab="elements"
                pending={squire.settings.pending}
                onShow={(tab) => setSheet(tab)}
              />
            }
            mentions={{
              documents: noteDocuments,
              onGoTo: (elementId, documentId, ordinal) => {
                setViewing(null);
                setCurrentId(documentId);
                setRevealMention((last) => ({
                  elementId,
                  documentId,
                  ordinal,
                  at: (last?.at ?? 0) + 1,
                }));
              },
            }}
            mentionsVisible={preferences.mentionsVisible}
            onCreateNamed={(name) => void createElement(name)}
            onMentionsVisible={(visible) => update({ mentionsVisible: visible })}
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
            tabs={
              <SidePanelTabs
                tab="notes"
                pending={squire.settings.pending}
                onShow={(tab) => setSheet(tab)}
              />
            }
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

        {sheet === "squire" && (
          <SquirePanel
            settings={squire.settings}
            proposals={squire.proposals}
            loaded={squire.loaded}
            origin={origin}
            tabs={
              <SidePanelTabs
                tab="squire"
                pending={squire.settings.pending}
                onShow={(tab) => setSheet(tab)}
              />
            }
            onClose={closeSheet}
            onProblem={setProblem}
          >
            <ProposalList
              proposals={squire.proposals}
              enabled={squire.settings.enabled}
              origin={origin}
              onGoToPassage={(proposal) => {
                setViewing(null);
                setCurrentId(proposal.documentId);
                setRevealPassage((last) => ({
                  documentId: proposal.documentId,
                  text: proposal.passage,
                  at: (last?.at ?? 0) + 1,
                }));
              }}
              onProblem={setProblem}
            />
          </SquirePanel>
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

      {updateOpen && available && (
        <UpdateDialog
          update={available}
          checking={preferences.checkForUpdates}
          onChecking={(allowed) => update({ checkForUpdates: allowed })}
          beforeRestart={savePendingNow}
          onClose={() => {
            setUpdateOpen(false);
            setUpdateLater(true);
          }}
        />
      )}

      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}

      {exporting && (
        <ExportDialog
          title={project.title}
          origin={origin}
          beforeExport={savePendingNow}
          chooseExportPath={pickers.chooseExportPath}
          chooseImage={pickers.chooseElementImage}
          onClose={() => {
            setExporting(false);
            if (workspace.tab === "writing") focusText();
          }}
        />
      )}

      {marking && (
        <MilestoneSlip
          paragraph={marking.paragraph}
          documentId={marking.documentId}
          elements={board.elements}
          origin={origin}
          beforeMarking={savePendingNow}
          onDone={() => {
            setMarking(null);
            focusText();
          }}
          onProblem={setProblem}
        />
      )}

      {workspace.threadsVisited && (
        <div
          id={panelId("threads")}
          role="tabpanel"
          aria-labelledby={tabId("threads")}
          hidden={workspace.tab !== "threads"}
        >
          <Suspense fallback={null}>
            <ThreadsTab
              threads={threads}
              board={board}
              origin={origin}
              onGoToMention={(elementId, documentId, ordinal) => {
                workspace.show("writing");
                setViewing(null);
                setCurrentId(documentId);
                setRevealMention((last) => ({
                  elementId,
                  documentId,
                  ordinal,
                  at: (last?.at ?? 0) + 1,
                }));
              }}
              onGoToPassage={(documentId, passage) => {
                workspace.show("writing");
                setViewing(null);
                setCurrentId(documentId);
                setRevealPassage((last) => ({
                  documentId,
                  text: passage,
                  at: (last?.at ?? 0) + 1,
                }));
              }}
              onProblem={setProblem}
            />
          </Suspense>
        </div>
      )}

      {workspace.boardVisited && (
        <div
          id={panelId("board")}
          role="tabpanel"
          aria-labelledby={tabId("board")}
          hidden={!onBoard}
        >
          {boardHome.detached ? (
            <div className="board-elsewhere">
              <p>El Tablero está en otra ventana.</p>
              <button type="button" className="action action-main" onClick={boardHome.bringBack}>
                Traerlo aquí
              </button>
            </div>
          ) : (
            <Suspense fallback={null}>
              <BoardTab
                board={board}
                loaded={boardLoaded}
                origin={origin}
                chooseImage={pickers.chooseElementImage}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}

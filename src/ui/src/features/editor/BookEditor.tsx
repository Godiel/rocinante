import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { onNotification, request } from "../../bridge/core";
import { toTipTapDocument } from "../../bridge/document";
import type {
  DocumentKind,
  DocumentState,
  ElementSummary,
  Note,
  Place,
  Statistics,
  TipTapDocument,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { anchorsOf, bookExtensions, footnotesOf } from "../../editor/extensions";
import { TypingSounds } from "../../editor/extensions/typing-sounds";
import { CurrentBlock } from "../../editor/extensions/current-block";
import { sounds } from "../../audio/engine";
import { registerPendingSave } from "../../editor/pending-saves";
import { platenScroll } from "../../editor/typewriter";
import type { SaveState } from "../counter/Counter";
import { BubbleToolbar } from "./BubbleToolbar";
import { TextPopover } from "./TextPopover";
import { TypewriterCaret } from "./TypewriterCaret";
import { NoteSlip } from "../notes/NoteSlip";
import { NoteStatesExtension } from "../../editor/extensions/note-states";
import { mentionAt, Mentions } from "../../editor/extensions/mentions";
import type { MentionIndex } from "../mentions/find-mentions";
import { MentionCard } from "../mentions/MentionCard";
import "./book-editor.css";
import { registerCursor, shownHead } from "../../editor/cursor";

const SAVE_DELAY_MS = 300;
const RETRY_DELAY_MS = 5000;
/** The longest typed text waits unsaved, so a crash loses less than two seconds. */
const MAX_UNSAVED_MS = 1000;
const PLACE_DELAY_MS = 1000;
const SLIP_WIDTH = 320;
/** The card over a mention waits this long before it comes and before it goes. */
const CARD_DELAY_MS = 300;
const CARD_WIDTH = 288;
const NO_ELEMENTS: readonly ElementSummary[] = [];

/** What the slip next to the text is editing. */
type Slip =
  | { kind: "newNote"; range: { from: number; to: number }; top: number; left: number }
  | { kind: "note"; note: Note; top: number; left: number }
  | {
      kind: "footnote";
      position: number;
      number: number;
      text: string;
      isNew: boolean;
      top: number;
      left: number;
    };

export interface BookEditorProps {
  document: DocumentState;
  /** Chapter or fragment, for the name screen readers give the text. */
  kind: DocumentKind;
  /** Where the writer left off in this document, if known. */
  place: Place | null;
  origin: string;
  /** The notes of this document, in the order they were written. */
  notes: Note[];
  /** Whether the notes of the work have arrived: until then no anchor is taken for one set aside. */
  notesLoaded?: boolean;
  typewriterScrolling: boolean;
  /** Counts after a save here, or after a change from another window. */
  onCounts(document: Statistics, work: Statistics): void;
  onSaveState(state: SaveState): void;
  onProblem(message: string | null): void;
  /** Makes a ficha named after the selected text, from the floating menu. The text does not change. */
  onCreateElement?(name: string): void;
  /** Opens a note in the panel beside the text, to resolve it or link it with fichas. */
  onOpenNote?(id: string): void;
  /**
   * Deletes a note, with the notice to undo it. Its anchor stays in the text, hidden, so undoing puts the
   * mark back where it was.
   */
  onDeleteNote?(id: string): void;
  /** A note whose passage the writer asked to see: it is selected and brought into view. */
  reveal?: { noteId: string; at: number } | null;
  /** The names of the fichas, to mark their mentions; null marks nothing. */
  mentionIndex?: MentionIndex | null;
  /** Whether the marks of the mentions show. */
  mentionsVisible?: boolean;
  /** A mention the writer asked to see, by its number among those of its ficha here. */
  revealMention?: { elementId: string; ordinal: number; at: number } | null;
  /** The fichas of the work, for the card that shows over a mention. */
  mentionElements?: readonly ElementSummary[];
  /** Opens a ficha in the panel beside the text. */
  onOpenElement?(id: string): void;
}

/**
 * The writing surface: borderless paper, formatting on selection and by keyboard, footnotes,
 * notes anchored in the text, the typewriter caret and, if the writer wants it, the platen that
 * keeps the line at the height of the eyes.
 */
export function BookEditor({
  document,
  kind,
  place,
  origin,
  notes,
  notesLoaded = true,
  typewriterScrolling,
  onCounts,
  onSaveState,
  onProblem,
  onCreateElement,
  onOpenNote,
  onDeleteNote,
  reveal = null,
  mentionIndex = null,
  mentionsVisible = true,
  revealMention = null,
  mentionElements = NO_ELEMENTS,
  onOpenElement,
}: BookEditorProps) {
  const frame = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const placeTimer = useRef<number | undefined>(undefined);
  const pendingSave = useRef<(() => Promise<void>) | null>(null);
  const unsavedSince = useRef<number | null>(null);
  const savePending = useRef(() => {
    window.clearTimeout(saveTimer.current);
    const save = pendingSave.current;
    pendingSave.current = null;
    unsavedSince.current = null;
    return save ? save() : Promise.resolve();
  }).current;
  const pointer = useRef(false);
  const platen = useRef(typewriterScrolling);
  platen.current = typewriterScrolling;
  const [slip, setSlip] = useState<Slip | null>(null);
  // The ficha in small over a mention: it comes after a short pause and goes a little after the hand.
  const [card, setCard] = useState<{ ids: string[]; top: number; left: number } | null>(null);
  const cardTimer = useRef<number | undefined>(undefined);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const callbacks = useRef({
    onCounts,
    onSaveState,
    onProblem,
    openNewNote: () => {},
    openNewFootnote: () => {},
  });
  callbacks.current.onCounts = onCounts;
  callbacks.current.onSaveState = onSaveState;
  callbacks.current.onProblem = onProblem;

  const editor = useEditor({
    // The typing sound lives only here: the page view and the versions reuse the schema in silence.
    extensions: [
      ...bookExtensions(),
      TypingSounds.configure({ play: (stroke) => sounds.play(stroke) }),
      CurrentBlock,
      NoteStatesExtension,
      Mentions,
    ],
    content: document.content,
    editorProps: {
      attributes: {
        "aria-label": kind === "chapter" ? "Texto del capítulo" : "Texto del fragmento",
        spellcheck: "true",
        lang: "es",
      },
      handleKeyDown: (_, event) => {
        pointer.current = false;
        const chord = (event.ctrlKey || event.metaKey) && event.altKey;
        if (chord && event.code === "KeyN") {
          callbacks.current.openNewNote();
          return true;
        }
        if (chord && event.code === "KeyF") {
          callbacks.current.openNewFootnote();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: current }) => {
      window.clearTimeout(saveTimer.current);
      callbacks.current.onSaveState({ kind: "typing" });
      // The whole text is read when the save happens, so a retry always sends the latest.
      const save = (): Promise<void> => {
        callbacks.current.onSaveState({ kind: "saving" });
        return request("document.save", {
          id: document.id,
          content: toTipTapDocument(current.getJSON()),
          origin,
        })
          .then((saved) => {
            callbacks.current.onCounts(saved.statistics, saved.work);
            if (!pendingSave.current) callbacks.current.onSaveState({ kind: "saved" });
          })
          .catch((error: unknown) => {
            // Nothing typed is given up: the save waits and tries again.
            if (!pendingSave.current) {
              pendingSave.current = save;
              saveTimer.current = window.setTimeout(() => void savePending(), RETRY_DELAY_MS);
            }
            callbacks.current.onSaveState({ kind: "failed", message: messageFor(error) });
          });
      };
      // A writer who never pauses still gets saved: the wait never runs past MAX_UNSAVED_MS.
      unsavedSince.current ??= Date.now();
      const left = unsavedSince.current + MAX_UNSAVED_MS - Date.now();
      pendingSave.current = save;
      saveTimer.current = window.setTimeout(
        () => void savePending(),
        Math.max(0, Math.min(SAVE_DELAY_MS, left)),
      );
    },
    onSelectionUpdate: ({ editor: current }) => {
      const { anchor, head } = current.state.selection;
      window.clearTimeout(placeTimer.current);
      placeTimer.current = window.setTimeout(() => {
        void request("place.save", { documentId: document.id, anchor, head });
      }, PLACE_DELAY_MS);
    },
    onTransaction: ({ editor: current, transaction }) => {
      // The platen moves for typing and keyboard moves, not when the writer clicks somewhere.
      if (!platen.current || (pointer.current && !transaction.docChanged)) return;
      if (!transaction.docChanged && !transaction.selectionSet) return;
      requestAnimationFrame(() => {
        if (current.isDestroyed) return;
        const delta = platenScroll(
          current.view.coordsAtPos(current.state.selection.head),
          window.innerHeight,
        );
        if (delta !== 0) window.scrollBy({ top: delta });
      });
    },
  });

  // The page view asks where the cursor is when it opens. What the writer sees on screen comes
  // first: on macOS the editor can learn of a click a moment after the selection shows, and the
  // page view would open where the cursor was before.
  useEffect(() => {
    if (!editor) return;
    return registerCursor(() =>
      editor.isDestroyed
        ? null
        : {
            documentId: document.id,
            position: shownHead(editor.view) ?? editor.state.selection.head,
          },
    );
  }, [editor, document.id]);

  // What is pending is saved when asked for, and when the editor leaves (another document).
  useEffect(() => {
    const unregister = registerPendingSave(savePending);
    return () => {
      unregister();
      void savePending();
    };
  }, [savePending]);

  // Back to where the writer left off, once the text is there.
  useEffect(() => {
    if (!editor) return;
    if (place?.documentId === document.id) {
      const end = editor.state.doc.content.size;
      editor.commands.setTextSelection({
        from: Math.min(place.anchor, end),
        to: Math.min(place.head, end),
      });
    }
    // The keyboard comes to the text, unless the writer is typing somewhere else (a new title).
    const busy = window.document.activeElement;
    if (busy instanceof HTMLInputElement || busy instanceof HTMLTextAreaElement) {
      editor.commands.scrollIntoView();
    } else {
      editor.commands.focus(undefined, { scrollIntoView: true });
    }
    // Only when the editor first appears; later the writer moves the cursor.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // «Ir al pasaje»: the passage of the note is selected and brought into view, the panel still open.
  const revealAt = reveal?.at;
  const revealNote = reveal?.noteId;
  useEffect(() => {
    if (!editor || !revealNote) return;
    const passage = anchorsOf(editor.state.doc).get(revealNote)?.[0];
    if (!passage) return;
    editor.chain().focus().setTextSelection(passage).scrollIntoView().run();
  }, [editor, revealNote, revealAt]);

  // The mentions of the fichas: looked for again when the names change, shown as the writer wants.
  useEffect(() => {
    editor?.commands.setMentionIndex(mentionIndex);
  }, [editor, mentionIndex]);
  useEffect(() => {
    editor?.commands.setMentionsVisible(mentionsVisible);
  }, [editor, mentionsVisible]);

  // «En el texto» of a ficha: the mention is selected and brought into view, the panel still open.
  const mentionAtRequest = revealMention?.at;
  const mentionElement = revealMention?.elementId;
  const mentionOrdinal = revealMention?.ordinal;
  useEffect(() => {
    if (!editor || !mentionIndex || mentionElement === undefined || mentionOrdinal === undefined)
      return;
    const range = mentionAt(editor.state.doc, mentionIndex, mentionElement, mentionOrdinal);
    if (range) editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  }, [editor, mentionIndex, mentionElement, mentionOrdinal, mentionAtRequest]);

  // How each anchor looks: faded when its note is resolved, hidden when the note was set aside.
  const noteStates = useMemo(
    () => ({
      resolved: notes.filter((note) => note.resolvedAt !== null).map((note) => note.id),
      shown: notesLoaded ? notes.map((note) => note.id) : null,
    }),
    [notes, notesLoaded],
  );
  const noteStatesKey = JSON.stringify(noteStates);
  const noteStatesRef = useRef(noteStates);
  noteStatesRef.current = noteStates;
  useEffect(() => {
    editor?.commands.setNoteStates(noteStatesRef.current);
  }, [editor, noteStatesKey]);

  // Changes made in other windows arrive here.
  useEffect(() => {
    if (!editor) return;
    const unlisten = onNotification("document.changed", (change) => {
      if (change.document.id !== document.id || change.origin === origin) return;
      editor.commands.setContent(change.document.content, { emitUpdate: false });
      editor.commands.setNoteStates(noteStatesRef.current);
      callbacks.current.onCounts(change.document.statistics, change.work);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [editor, document.id, origin]);

  const slipAt = (position: number) => {
    const container = frame.current!.getBoundingClientRect();
    const coords = editor!.view.coordsAtPos(position);
    return {
      top: Math.round(coords.bottom - container.top + 8),
      left: Math.round(
        Math.max(0, Math.min(coords.left - container.left - 24, container.width - SLIP_WIDTH)),
      ),
    };
  };

  callbacks.current.openNewNote = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setSlip({ kind: "newNote", range: { from, to }, ...slipAt(to) });
  };

  callbacks.current.openNewFootnote = () => {
    if (!editor) return;
    const position = editor.state.selection.to;
    editor.chain().setTextSelection(position).insertFootnote().run();
    const entry = footnotesOf(editor.state.doc).find((footnote) => footnote.position === position);
    setSlip({
      kind: "footnote",
      position,
      number: entry?.number ?? 1,
      text: "",
      isNew: true,
      ...slipAt(position),
    });
  };

  function onClick(event: MouseEvent) {
    if (!editor) return;
    const target = event.target as HTMLElement;
    const anchor = target.closest<HTMLElement>(".ProseMirror [data-note-id]");
    const note = anchor?.dataset.noteId ? notesById.get(anchor.dataset.noteId) : undefined;
    if (note) {
      setSlip({ kind: "note", note, ...slipAt(editor.view.posAtDOM(anchor!, 0)) });
      return;
    }
    const sup = target.closest<HTMLElement>(".ProseMirror sup[data-footnote]");
    if (sup) {
      const index = [...editor.view.dom.querySelectorAll("sup[data-footnote]")].indexOf(sup);
      const entry = footnotesOf(editor.state.doc)[index];
      if (entry) setSlip({ kind: "footnote", ...entry, isNew: false, ...slipAt(entry.position) });
    }
  }

  function onMouseOver(event: MouseEvent) {
    const mark = (event.target as HTMLElement).closest<HTMLElement>(".book-page .mention");
    if (!mark || !frame.current) return;
    window.clearTimeout(cardTimer.current);
    const ids = (mark.dataset.elements ?? "").split(" ").filter(Boolean);
    cardTimer.current = window.setTimeout(() => {
      const container = frame.current!.getBoundingClientRect();
      const box = mark.getBoundingClientRect();
      setCard({
        ids,
        top: Math.round(box.bottom - container.top + 6),
        left: Math.round(
          Math.max(0, Math.min(box.left - container.left, container.width - CARD_WIDTH)),
        ),
      });
    }, CARD_DELAY_MS);
  }

  function onMouseOut(event: MouseEvent) {
    const mark = (event.target as HTMLElement).closest(".book-page .mention");
    if (!mark || mark.contains(event.relatedTarget as Node | null)) return;
    window.clearTimeout(cardTimer.current);
    cardTimer.current = window.setTimeout(() => setCard(null), CARD_DELAY_MS);
  }

  async function act(action: () => Promise<unknown>) {
    try {
      await action();
      onProblem(null);
    } catch (error) {
      onProblem(messageFor(error));
    }
  }

  function closeSlip() {
    if (slip?.kind === "footnote" && slip.isNew) deleteFootnote(slip.position);
    setSlip(null);
    editor?.commands.focus();
  }

  function deleteFootnote(position: number) {
    editor
      ?.chain()
      .deleteRange({ from: position, to: position + 1 })
      .run();
  }

  async function saveNote(content: TipTapDocument) {
    if (!editor || !slip) return;
    const current = slip;
    setSlip(null);
    if (current.kind === "newNote") {
      await act(async () => {
        const note = await request("note.create", {
          documentId: document.id,
          content,
          anchored: true,
          origin,
        });
        editor.chain().focus().anchorNote(note.id, current.range).run();
      });
    } else if (current.kind === "note") {
      await act(() =>
        request("note.update", { id: current.note.id, changes: { content }, origin }),
      );
      editor.commands.focus();
    }
  }

  function saveFootnote(text: string) {
    if (!editor || slip?.kind !== "footnote") return;
    const position = slip.position;
    setSlip(null);
    editor.chain().focus().setFootnoteText(position, text).run();
  }

  async function deleteSlip() {
    if (!editor || !slip) return;
    const current = slip;
    setSlip(null);
    if (current.kind === "note") {
      if (onDeleteNote) onDeleteNote(current.note.id);
      else await act(() => request("note.delete", { id: current.note.id, origin }));
    } else if (current.kind === "footnote") {
      deleteFootnote(current.position);
    }
    editor.commands.focus();
  }

  if (!editor) return null;

  return (
    <div
      ref={frame}
      className={`book-frame${typewriterScrolling ? " book-frame-platen" : ""}`}
      onPointerDown={() => {
        pointer.current = true;
      }}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      <EditorContent editor={editor} className={`book-page book-page-${kind}`} />
      <TypewriterCaret editor={editor} frame={frame} />
      <BubbleToolbar
        editor={editor}
        onNote={() => callbacks.current.openNewNote()}
        onFootnote={() => callbacks.current.openNewFootnote()}
        onCreateElement={onCreateElement}
      />
      <Footnotes
        editor={editor}
        onOpen={(entry) =>
          setSlip({ kind: "footnote", ...entry, isNew: false, ...slipAt(entry.position) })
        }
      />
      <LooseNotes
        notes={notes}
        onOpen={(note, top) => setSlip({ kind: "note", note, top, left: 0 })}
        frame={frame}
      />
      {card && mentionsVisible && (
        <MentionCard
          elements={mentionElements.filter((element) => card.ids.includes(element.id))}
          top={card.top}
          left={card.left}
          onOpen={(id) => {
            setCard(null);
            onOpenElement?.(id);
          }}
          onEnter={() => window.clearTimeout(cardTimer.current)}
          onLeave={() => {
            cardTimer.current = window.setTimeout(() => setCard(null), CARD_DELAY_MS);
          }}
        />
      )}
      {slip?.kind === "footnote" && (
        <TextPopover
          key={`${slip.kind}:${slip.top}:${slip.left}`}
          title={`Nota al pie ${slip.number}`}
          initial={slip.text}
          top={slip.top}
          left={slip.left}
          onSave={saveFootnote}
          onCancel={closeSlip}
          onDelete={slip.isNew ? undefined : () => void deleteSlip()}
        />
      )}
      {(slip?.kind === "note" || slip?.kind === "newNote") && (
        <NoteSlip
          key={`${slip.kind}:${slip.kind === "note" ? slip.note.id : ""}:${slip.top}:${slip.left}`}
          initial={slip.kind === "note" ? slip.note : null}
          top={slip.top}
          left={slip.left}
          onSave={(content) => void saveNote(content)}
          onCancel={closeSlip}
          onDelete={slip.kind === "note" ? () => void deleteSlip() : undefined}
          onOpenInPanel={
            slip.kind === "note" && onOpenNote
              ? () => {
                  const id = slip.note.id;
                  setSlip(null);
                  onOpenNote(id);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** The footnotes of the chapter, numbered, under the text as in a printed page. */
function Footnotes({
  editor,
  onOpen,
}: {
  editor: Editor;
  onOpen(entry: ReturnType<typeof footnotesOf>[number]): void;
}) {
  const footnotes = useEditorState({
    editor,
    selector: ({ editor: current }) => footnotesOf(current.state.doc),
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  if (footnotes.length === 0) return null;
  return (
    <section className="book-apparatus" aria-label="Notas al pie">
      <ol className="book-footnotes">
        {footnotes.map((entry) => (
          <li key={entry.position} value={entry.number}>
            <button type="button" className="book-footnote" onClick={() => onOpen(entry)}>
              {entry.text || <span className="book-footnote-empty">Sin texto</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Notes whose passage was deleted: they stay with the chapter so nothing is lost. */
function LooseNotes({
  notes,
  onOpen,
  frame,
}: {
  notes: Note[];
  onOpen(note: Note, top: number): void;
  frame: React.RefObject<HTMLDivElement | null>;
}) {
  const loose = notes.filter((note) => !note.anchored);
  if (loose.length === 0) return null;
  return (
    <section className="book-apparatus" aria-labelledby="loose-notes-title">
      <h2 id="loose-notes-title" className="book-apparatus-title small-caps">
        Notas sin pasaje
      </h2>
      <ul className="book-loose-notes">
        {loose.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              className="book-loose-note"
              onClick={(event) => {
                const container = frame.current!.getBoundingClientRect();
                onOpen(
                  note,
                  Math.round(
                    event.currentTarget.getBoundingClientRect().bottom - container.top + 8,
                  ),
                );
              }}
            >
              {note.text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

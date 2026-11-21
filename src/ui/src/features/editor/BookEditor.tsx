import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { onNotification, request } from "../../bridge/core";
import { toTipTapDocument } from "../../bridge/document";
import type {
  DocumentKind,
  DocumentState,
  Note,
  Place,
  Statistics,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { bookExtensions, footnotesOf } from "../../editor/extensions";
import { TypingSounds } from "../../editor/extensions/typing-sounds";
import { CurrentBlock } from "../../editor/extensions/current-block";
import { sounds } from "../../audio/engine";
import { registerPendingSave } from "../../editor/pending-saves";
import { platenScroll } from "../../editor/typewriter";
import type { SaveState } from "../counter/Counter";
import { BubbleToolbar } from "./BubbleToolbar";
import { TextPopover } from "./TextPopover";
import { TypewriterCaret } from "./TypewriterCaret";
import { useNotes } from "./useNotes";
import "./book-editor.css";
import { registerCursor } from "../../editor/cursor";

const SAVE_DELAY_MS = 300;
const RETRY_DELAY_MS = 5000;
/** The longest typed text waits unsaved, so a crash loses less than two seconds. */
const MAX_UNSAVED_MS = 1000;
const PLACE_DELAY_MS = 1000;
const SLIP_WIDTH = 320;

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
  typewriterScrolling: boolean;
  /** Counts after a save here, or after a change from another window. */
  onCounts(document: Statistics, work: Statistics): void;
  onSaveState(state: SaveState): void;
  onProblem(message: string | null): void;
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
  typewriterScrolling,
  onCounts,
  onSaveState,
  onProblem,
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
  const notes = useNotes(document.id);
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

  // The page view asks where the cursor is when it opens.
  useEffect(() => {
    if (!editor) return;
    return registerCursor(() =>
      editor.isDestroyed
        ? null
        : { documentId: document.id, position: editor.state.selection.head },
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

  // Changes made in other windows arrive here.
  useEffect(() => {
    if (!editor) return;
    const unlisten = onNotification("document.changed", (change) => {
      if (change.document.id !== document.id || change.origin === origin) return;
      editor.commands.setContent(change.document.content, { emitUpdate: false });
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

  async function saveSlip(text: string) {
    if (!editor || !slip) return;
    const current = slip;
    setSlip(null);
    switch (current.kind) {
      case "newNote":
        await act(async () => {
          const note = await request("note.create", {
            documentId: document.id,
            text,
            anchored: true,
            origin,
          });
          editor.chain().focus().anchorNote(note.id, current.range).run();
        });
        break;
      case "note":
        await act(() => request("note.update", { id: current.note.id, text, origin }));
        editor.commands.focus();
        break;
      case "footnote":
        editor.chain().focus().setFootnoteText(current.position, text).run();
        break;
    }
  }

  async function deleteSlip() {
    if (!editor || !slip) return;
    const current = slip;
    setSlip(null);
    if (current.kind === "note") {
      await act(async () => {
        await request("note.delete", { id: current.note.id, origin });
        editor.commands.removeNoteAnchors(current.note.id);
      });
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
    >
      <EditorContent editor={editor} className={`book-page book-page-${kind}`} />
      <TypewriterCaret editor={editor} frame={frame} />
      <BubbleToolbar
        editor={editor}
        onNote={() => callbacks.current.openNewNote()}
        onFootnote={() => callbacks.current.openNewFootnote()}
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
      {slip && (
        <TextPopover
          key={`${slip.kind}:${slip.top}:${slip.left}`}
          title={slip.kind === "footnote" ? `Nota al pie ${slip.number}` : "Nota"}
          initial={
            slip.kind === "note" ? slip.note.text : slip.kind === "footnote" ? slip.text : ""
          }
          top={slip.top}
          left={slip.left}
          onSave={(text) => void saveSlip(text)}
          onCancel={closeSlip}
          onDelete={
            slip.kind === "note" || (slip.kind === "footnote" && !slip.isNew)
              ? () => void deleteSlip()
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

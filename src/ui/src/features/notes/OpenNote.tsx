import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementSummary, Note, TipTapDocument } from "../../bridge/generated/protocol";
import { NoteEditor } from "./NoteEditor";
import { NoteElements } from "./NoteElements";
import { useNoteSaver } from "./useNoteSaver";

const EMPTY: TipTapDocument = { type: "doc", content: [{ type: "paragraph" }] };

export interface OpenNoteProps {
  /** The note as the core has it, or null for a new idea not yet written. */
  note: Note | null;
  /** The fichas a new idea starts linked with. */
  draftElements: readonly string[];
  /** Where the note belongs: its chapter, or «Idea suelta». */
  where: string;
  /** The fichas in the work. */
  elements: readonly ElementSummary[];
  origin: string;
  onCreated(note: Note): void;
  onGoToPassage(note: Note): void;
  onDelete(note: Note): void;
  onOpenElement(id: string): void;
  onProblem(message: string | null): void;
}

/** One note in the panel: its text, whether it is resolved, its fichas and the way to its passage. */
export function OpenNote({
  note,
  draftElements,
  where,
  elements,
  origin,
  onCreated,
  onGoToPassage,
  onDelete,
  onOpenElement,
  onProblem,
}: OpenNoteProps) {
  const [dirty, setDirty] = useState(false);
  // The box answers the click at once; what another window decides arrives with the note.
  const stored = note?.resolvedAt != null;
  const [resolved, setResolved] = useState({ stored, shown: stored });
  if (resolved.stored !== stored) setResolved({ stored, shown: stored });
  // A new idea keeps its fichas here until it has words and is created with them.
  const [draftLinked, setDraftLinked] = useState<readonly string[]>(draftElements);
  const linked = note?.elements ?? draftLinked;
  // A new idea left before its words reached the core is still created, but does not open again.
  const open = useRef(true);
  useEffect(
    () => () => {
      open.current = false;
    },
    [],
  );
  const events = useMemo(
    () => ({
      onProblem,
      onCreated: (created: Note) => {
        if (open.current) onCreated(created);
      },
      onIdle: () => setDirty(false),
    }),
    [onProblem, onCreated],
  );
  const saver = useNoteSaver(note?.id ?? null, linked, origin, events);
  const onChange = useCallback(
    (content: TipTapDocument, text: string) => {
      setDirty(true);
      saver.change({ content }, text);
    },
    [saver],
  );

  return (
    <div className="open-note">
      <p className="open-note-where small-caps">{where}</p>
      <NoteEditor
        content={note?.content ?? EMPTY}
        label="Texto de la nota"
        dirty={dirty}
        autoFocus={note === null}
        onChange={onChange}
      />
      <NoteElements
        linked={linked}
        elements={elements}
        onChange={(next) => {
          if (!note) {
            setDraftLinked(next);
            return;
          }
          saver.change({ elements: next });
          void saver.flush();
        }}
        onOpenElement={(id) => void saver.flush().then(() => onOpenElement(id))}
      />
      {note && (
        <div className="open-note-actions">
          <label className="open-note-resolved">
            <input
              type="checkbox"
              checked={resolved.shown}
              onChange={(event) => {
                setResolved({ stored, shown: event.target.checked });
                saver.change({ resolved: event.target.checked });
                void saver.flush();
              }}
            />{" "}
            Resuelta
          </label>
          {note.anchored && (
            <button
              type="button"
              className="action"
              onClick={() => void saver.flush().then(() => onGoToPassage(note))}
            >
              Ir al pasaje
            </button>
          )}
          <button
            type="button"
            className="action open-note-delete"
            onClick={() => void saver.flush().then(() => onDelete(note))}
          >
            Borrar
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import type { Board, Note } from "../../bridge/generated/protocol";
import { ElementNotes } from "../notes/ElementNotes";
import { ElementMentions } from "../mentions/ElementMentions";
import { ElementRelations } from "./ElementRelations";
import { ElementSheet } from "./ElementSheet";
import { useElement } from "./useBoard";

export interface OpenElementSheetProps {
  id: string;
  field: "name" | "kind" | null;
  /** The work, for the other names and the relationships. */
  board: Board;
  origin: string;
  chooseImage(): Promise<string | null>;
  onOpen(id: string): void;
  onProblem(message: string | null): void;
  /** Sends the ficha to the trash, with its relationships. */
  onTrash(id: string, name: string): void;
  /** Where the text is at hand: «En el texto» shows the mentions of the ficha and takes the text to each. */
  mentions?: {
    documents: readonly { id: string; title: string }[];
    onGoTo(elementId: string, documentId: string, ordinal: number): void;
  };
  /** The notes of the work, where the panel of notes is at hand: the ficha shows those about it. */
  notes?: {
    all: readonly Note[];
    onOpen(id: string): void;
    onGoToPassage(note: Note): void;
    onNew(elementId: string): void;
  };
}

/**
 * The ficha of one element, loaded and kept current: the same beside the text and beside the board. A ficha
 * just created takes the keyboard to the field the writer goes to first.
 */
export function OpenElementSheet({
  id,
  field,
  board,
  origin,
  onOpen,
  onProblem,
  onTrash,
  notes,
  mentions,
  ...props
}: OpenElementSheetProps) {
  const element = useElement(id);
  const frame = useRef<HTMLDivElement>(null);
  const ready = element !== null;

  // A new ficha starts at its name, or at its kind when the name came from the text.
  useEffect(() => {
    if (!ready || !field) return;
    const target = frame.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      field === "name" ? ".element-name" : ".element-kind select",
    );
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [ready, field]);

  return (
    <div ref={frame}>
      {element ? (
        <>
          <ElementSheet
            key={id}
            element={element}
            others={board.elements}
            origin={origin}
            onOpen={onOpen}
            onProblem={onProblem}
            {...props}
          />
          <ElementRelations
            elementId={id}
            board={board}
            origin={origin}
            onOpen={onOpen}
            onProblem={onProblem}
          />
          {mentions && (
            <ElementMentions
              elementId={id}
              documents={mentions.documents}
              onGoTo={(documentId, ordinal) => mentions.onGoTo(id, documentId, ordinal)}
              elements={board.elements}
              onOpenElement={onOpen}
            />
          )}
          {notes && (
            <ElementNotes
              notes={notes.all.filter((note) => note.elements.includes(id))}
              onOpen={notes.onOpen}
              onGoToPassage={notes.onGoToPassage}
              onNew={() => notes.onNew(id)}
            />
          )}
          <p className="element-section element-trash">
            <button
              type="button"
              className="action"
              onClick={() => onTrash(element.id, element.name)}
            >
              Mandar a la papelera
            </button>
          </p>
        </>
      ) : (
        <p className="elements-empty">Abriendo la ficha…</p>
      )}
    </div>
  );
}

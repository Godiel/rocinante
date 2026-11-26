import type { Note } from "../../bridge/generated/protocol";
import { orderNotes, preview } from "./notes-list";

export interface ElementNotesProps {
  /** The notes linked with the ficha. */
  notes: readonly Note[];
  /** Opens a note in the panel of notes. */
  onOpen(id: string): void;
  /** Starts a new idea, linked with the ficha. */
  onNew(): void;
}

/** The notes about a ficha, in the ficha itself: each opens in the panel of notes, and a new one starts there. */
export function ElementNotes({ notes, onOpen, onNew }: ElementNotesProps) {
  const shown = orderNotes(notes);

  return (
    <section className="element-section element-notes">
      <h3 className="element-label">Notas</h3>
      {shown.length === 0 && <p className="element-quiet">Aún no tiene notas.</p>}
      {shown.length > 0 && (
        <ul className="element-notes-list">
          {shown.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className={`element-note${note.resolvedAt ? " element-note-resolved" : ""}`}
                title={note.resolvedAt ? "Nota resuelta" : "Abrir la nota"}
                onClick={() => onOpen(note.id)}
              >
                {preview(note, 90)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="action element-add" onClick={onNew}>
        Nueva nota
      </button>
    </section>
  );
}

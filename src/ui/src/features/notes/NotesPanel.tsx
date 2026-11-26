import { useMemo, type ReactNode } from "react";
import type { Note } from "../../bridge/generated/protocol";
import { ALL_NOTES, filterNotes, orderNotes, preview } from "./notes-list";
import "./notes.css";

export interface NotesPanelProps {
  notes: readonly Note[];
  loaded: boolean;
  /** The tabs of the panel, shown in place of its title. */
  tabs?: ReactNode;
  onClose(): void;
}

/** The notes of the work beside the text: loose ideas and the notes of every chapter. */
export function NotesPanel({ notes, loaded, tabs, onClose }: NotesPanelProps) {
  const shown = useMemo(() => orderNotes(filterNotes(notes, ALL_NOTES)), [notes]);

  return (
    <aside
      className="sheet notes-panel"
      aria-label="Notas de la obra"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if ((event.target as HTMLElement).closest("[data-own-keys]")) return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="sheet-header small-caps">
        {tabs ?? <h2 className="sheet-title">Notas</h2>}
        <button type="button" className="action" onClick={onClose} title="Cerrar (Ctrl+Mayús+N)">
          Cerrar
        </button>
      </header>

      {loaded && shown.length === 0 && (
        <p className="notes-empty">
          Aún no hay notas. Selecciona un pasaje y pulsa Ctrl+Alt+N para anotarlo.
        </p>
      )}
      <ul className="notes-list">
        {shown.map((note) => (
          <li key={note.id} className="notes-item">
            {preview(note)}
          </li>
        ))}
      </ul>
    </aside>
  );
}

import { useId, useState, type KeyboardEvent } from "react";
import type { TipTapDocument } from "../../bridge/generated/protocol";
import { NoteEditor } from "./NoteEditor";

/** The most a note can hold, as the core counts it: the characters of its text. */
export const MAX_NOTE_LENGTH = 10_000;

const EMPTY: TipTapDocument = { type: "doc", content: [{ type: "paragraph" }] };

export interface NoteSlipProps {
  /** The note as it is, or null for a new one. */
  initial: { content: TipTapDocument; text: string } | null;
  /** Position inside the editor's frame, in px. */
  top: number;
  left: number;
  onSave(content: TipTapDocument): void;
  onCancel(): void;
  /** Shown only for a note that exists. */
  onDelete?: () => void;
  /** Takes the note to the panel, to resolve it or link it with fichas. */
  onOpenInPanel?: () => void;
}

/**
 * A slip of paper next to the text to write a note. Ctrl+Enter keeps it, Escape leaves it as it was.
 * Nothing is saved until the writer says so.
 */
export function NoteSlip({
  initial,
  top,
  left,
  onSave,
  onCancel,
  onDelete,
  onOpenInPanel,
}: NoteSlipProps) {
  const [draft, setDraft] = useState({
    content: initial?.content ?? EMPTY,
    text: initial?.text ?? "",
  });
  const [problem, setProblem] = useState<string | null>(null);
  const id = useId();

  function save() {
    if (!draft.text.trim()) {
      setProblem("Escribe algo o pulsa Escape para dejarlo.");
      return;
    }
    if (draft.text.length > MAX_NOTE_LENGTH) {
      setProblem("La nota es demasiado larga.");
      return;
    }
    onSave(draft.content);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="text-popover note-slip"
      style={{ top, left }}
      role="dialog"
      aria-labelledby={id}
      onKeyDown={onKeyDown}
      data-own-keys=""
    >
      <p id={id} className="text-popover-title small-caps">
        Nota
      </p>
      <NoteEditor
        content={draft.content}
        label="Texto de la nota"
        dirty
        autoFocus
        onSubmit={save}
        onChange={(content, text) => {
          setDraft({ content, text });
          setProblem(null);
        }}
      />
      {problem && (
        <p className="text-popover-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="text-popover-actions">
        <button type="button" className="action action-main" onClick={save}>
          Guardar
        </button>
        <button type="button" className="action" onClick={onCancel}>
          Cancelar
        </button>
        {onOpenInPanel && (
          <button type="button" className="action" onClick={onOpenInPanel}>
            Abrir en el panel
          </button>
        )}
        {onDelete && (
          <button type="button" className="action text-popover-delete" onClick={onDelete}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

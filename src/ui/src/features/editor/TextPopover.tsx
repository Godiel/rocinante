import { useId, useState, type KeyboardEvent } from "react";

export interface TextPopoverProps {
  /** Small-caps heading: «Nota», «Nota al pie 3». */
  title: string;
  initial: string;
  /** Position inside the editor's frame, in px. */
  top: number;
  left: number;
  onSave(text: string): void;
  onCancel(): void;
  /** Shown only when there is something to delete. */
  onDelete?: () => void;
}

/**
 * A slip of paper next to the text to write a note or a footnote. Ctrl+Enter keeps it, Escape
 * leaves it as it was. Nothing is saved until the writer says so.
 */
export function TextPopover({
  title,
  initial,
  top,
  left,
  onSave,
  onCancel,
  onDelete,
}: TextPopoverProps) {
  const [text, setText] = useState(initial);
  const [empty, setEmpty] = useState(false);
  const id = useId();

  function save() {
    if (!text.trim()) {
      setEmpty(true);
      return;
    }
    onSave(text.trim());
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  }

  return (
    <div
      className="text-popover"
      style={{ top, left }}
      role="dialog"
      aria-labelledby={id}
      onKeyDown={onKeyDown}
    >
      <p id={id} className="text-popover-title small-caps">
        {title}
      </p>
      <textarea
        className="text-popover-text"
        value={text}
        rows={3}
        autoFocus
        aria-labelledby={id}
        aria-invalid={empty}
        onChange={(event) => {
          setText(event.target.value);
          setEmpty(false);
        }}
      />
      {empty && (
        <p className="text-popover-problem" role="alert">
          Escribe algo o pulsa Escape para dejarlo.
        </p>
      )}
      <div className="text-popover-actions">
        <button type="button" className="action action-main" onClick={save}>
          Guardar
        </button>
        <button type="button" className="action" onClick={onCancel}>
          Cancelar
        </button>
        {onDelete && (
          <button type="button" className="action text-popover-delete" onClick={onDelete}>
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect } from "react";

/** How long the writer has to change their mind before the notice leaves. */
export const UNDO_MS = 8000;

interface UndoNoticeProps {
  message: string;
  onUndo(): void;
  onDismiss(): void;
}

/**
 * A quiet line at the foot of the window after something went to the trash, with the way back.
 * It leaves by itself (give each deletion its own key to restart the wait); what was deleted stays in the trash all the same.
 */
export function UndoNotice({ message, onUndo, onDismiss }: UndoNoticeProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="undo-notice" role="status">
      <span>{message}</span>
      <button type="button" className="action action-main" onClick={onUndo}>
        Deshacer
      </button>
    </div>
  );
}

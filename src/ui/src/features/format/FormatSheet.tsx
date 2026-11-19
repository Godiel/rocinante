import { useCallback, useEffect, useRef } from "react";
import { request } from "../../bridge/core";
import type { WorkFormat } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { FormatForm } from "./FormatForm";

/** Typing «14,8» goes through «1» and «14,»: the core hears of a measure once the writer pauses. */
const SEND_DELAY_MS = 300;

export interface FormatSheetProps {
  format: WorkFormat;
  /** Title of the work, to say whose format this is. */
  title: string;
  origin: string;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The format of the work, on the sheet to the right of the text. Every change is sent to the core,
 * which tells every window; the text behind the sheet shows it at once.
 */
export function FormatSheet({ format, title, origin, onClose, onProblem }: FormatSheetProps) {
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<WorkFormat | null>(null);

  const send = useCallback(
    (next: WorkFormat) => {
      pending.current = null;
      request("project.setFormat", { format: next, origin })
        .then(() => onProblem(null))
        .catch((error: unknown) => onProblem(messageFor(error)));
    },
    [origin, onProblem],
  );
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  }, [send]);

  // Closing the sheet does not lose the last change.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current) latestSend.current(pending.current);
    },
    [],
  );

  return (
    <aside
      className="sheet format-sheet"
      aria-label={`Formato de «${title}»`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="sheet-header small-caps">
        <h2 className="sheet-title">Formato</h2>
        <button type="button" className="action" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <p className="format-of">{title}</p>
      <FormatForm
        value={format}
        onChange={(next) => {
          pending.current = next;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => send(next), SEND_DELAY_MS);
        }}
      />
    </aside>
  );
}

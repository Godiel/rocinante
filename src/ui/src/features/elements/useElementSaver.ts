import { useCallback, useEffect, useRef } from "react";
import { request } from "../../bridge/core";
import type { ElementChanges } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { registerPendingSave } from "../../editor/pending-saves";

/** Typing a name goes letter by letter: the core hears of it once the writer pauses. */
export const SAVE_DELAY_MS = 500;

export interface ElementSaverEvents {
  /** Something was saved, or failed; null clears an earlier problem. */
  onProblem(message: string | null): void;
  /** Nothing is waiting any more: what the core has is what the writer typed. */
  onIdle(): void;
}

/**
 * Saves the changes to an element after a pause, all of them in one request, and at once when something
 * is about to take the element away (closing the window, the work or the ficha).
 */
export function useElementSaver(
  id: string,
  origin: string,
  events: ElementSaverEvents,
): { change(changes: ElementChanges): void; flush(): Promise<void> } {
  const queued = useRef<ElementChanges>({});
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(events);
  useEffect(() => {
    latest.current = events;
  }, [events]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const changes = queued.current;
    queued.current = {};
    if (Object.keys(changes).length > 0) {
      inFlight.current = inFlight.current
        .then(() => request("element.update", { id, changes, origin }))
        .then(
          () => latest.current.onProblem(null),
          (error: unknown) => latest.current.onProblem(messageFor(error)),
        )
        .then(() => {
          if (timer.current === undefined && Object.keys(queued.current).length === 0) {
            latest.current.onIdle();
          }
        });
    }
    return inFlight.current;
  }, [id, origin]);

  const change = useCallback(
    (changes: ElementChanges) => {
      queued.current = { ...queued.current, ...changes };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Whatever is pending is saved before the ficha goes, and whenever the app asks for it.
  useEffect(() => {
    const unregister = registerPendingSave(flush);
    return () => {
      unregister();
      void flush();
    };
  }, [flush]);

  return { change, flush };
}

import { useCallback, useEffect, useRef } from "react";
import { request } from "../../bridge/core";
import type { Note, NoteChanges } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { registerPendingSave } from "../../editor/pending-saves";
import { MAX_NOTE_LENGTH } from "./NoteSlip";

/** Typing goes letter by letter: the core hears of it once the writer pauses. */
export const NOTE_SAVE_DELAY_MS = 500;

export interface NoteSaverEvents {
  /** Something was saved, or failed; null clears an earlier problem. */
  onProblem(message: string | null): void;
  /** A new idea has just been created in the core, with its first words. */
  onCreated(note: Note): void;
  /** Nothing is waiting any more: what the core has is what the writer typed. */
  onIdle(): void;
}

/**
 * Saves the changes to a note after a pause, all of them in one request, and at once when something is about
 * to take the note away. A new idea (`id` null) is created in the core only once it has some words, linked
 * with `elements`.
 */
export function useNoteSaver(
  id: string | null,
  elements: readonly string[],
  origin: string,
  events: NoteSaverEvents,
): { change(changes: NoteChanges, text?: string): void; flush(): Promise<void> } {
  const target = useRef(id);
  const queued = useRef<NoteChanges>({});
  const words = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ events, elements });
  useEffect(() => {
    latest.current = { events, elements };
  }, [events, elements]);
  useEffect(() => {
    target.current = id;
  }, [id]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const changes = queued.current;
    const text = words.current;
    if (Object.keys(changes).length === 0) return inFlight.current;

    // A note with no words, or too many, waits for the writer: the core would refuse it.
    if (text !== null && (text.trim() === "" || text.length > MAX_NOTE_LENGTH)) {
      if (text.length > MAX_NOTE_LENGTH)
        latest.current.events.onProblem("La nota es demasiado larga.");
      return inFlight.current;
    }

    queued.current = {};
    inFlight.current = inFlight.current
      .then(async () => {
        const existing = target.current;
        if (existing) {
          await request("note.update", { id: existing, changes, origin });
        } else if (changes.content) {
          const created = await request("note.create", {
            documentId: null,
            content: changes.content,
            anchored: false,
            elements: [...latest.current.elements],
            origin,
          });
          target.current = created.id;
          latest.current.events.onCreated(created);
        }
      })
      .then(
        () => latest.current.events.onProblem(null),
        (error: unknown) => latest.current.events.onProblem(messageFor(error)),
      )
      .then(() => {
        if (timer.current === undefined && Object.keys(queued.current).length === 0) {
          latest.current.events.onIdle();
        }
      });
    return inFlight.current;
  }, [origin]);

  const change = useCallback(
    (changes: NoteChanges, text?: string) => {
      queued.current = { ...queued.current, ...changes };
      if (text !== undefined) words.current = text;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), NOTE_SAVE_DELAY_MS);
    },
    [flush],
  );

  // Whatever is pending is saved before the note goes, and whenever the app asks for it.
  useEffect(() => {
    const unregister = registerPendingSave(flush);
    return () => {
      unregister();
      void flush();
    };
  }, [flush]);

  return { change, flush };
}

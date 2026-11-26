import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Note } from "../../bridge/generated/protocol";

const byCreation = (a: Note, b: Note) => a.createdAt.localeCompare(b.createdAt);

/** The notes of a document, in the order they were written, kept current with what any window does to them. */
export function useNotes(documentId: string): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    let current = true;
    const mine = (note: Note) => note.documentId === documentId;
    void request("notes.get").then((all) => {
      if (current) setNotes(all.filter(mine).sort(byCreation));
    });
    const unlisten = onNotification("notes.changed", (change) => {
      setNotes((shown) => {
        const gone = new Set([...change.removed, ...change.notes.map((note) => note.id)]);
        return [...shown.filter((note) => !gone.has(note.id)), ...change.notes.filter(mine)].sort(
          byCreation,
        );
      });
    });
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [documentId]);

  return notes;
}

import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Note } from "../../bridge/generated/protocol";

/** The notes of a document, kept current with what any window does to them. */
export function useNotes(documentId: string): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    let current = true;
    void request("note.list", { documentId }).then((list) => {
      if (current) setNotes(list);
    });
    const unlisten = onNotification("notes.changed", (change) => {
      if (change.documentId === documentId) setNotes(change.notes);
    });
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [documentId]);

  return notes;
}

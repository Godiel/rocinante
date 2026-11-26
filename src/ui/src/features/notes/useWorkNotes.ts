import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Note } from "../../bridge/generated/protocol";
import { applyNotesChange, type NotesChange } from "./notes-state";

const NONE: Note[] = [];

/**
 * The notes of the open work, loose ideas and the notes of its documents, kept current with what any window
 * does to them. `workId` names the work: a different one loads its own notes.
 */
export function useWorkNotes(workId: string): { notes: Note[]; loaded: boolean } {
  const [state, setState] = useState<{ workId: string; notes: Note[]; loaded: boolean }>({
    workId,
    notes: NONE,
    loaded: false,
  });

  useEffect(() => {
    let current = true;
    // Changes that arrive before the notes themselves are applied on top of them.
    const early: NotesChange[] = [];
    let loaded = false;
    const unlisten = onNotification("notes.changed", (change) => {
      if (!loaded) {
        early.push(change);
        return;
      }
      setState((previous) => ({ ...previous, notes: applyNotesChange(previous.notes, change) }));
    });
    void request("notes.get").then((notes) => {
      if (!current) return;
      loaded = true;
      setState({ workId, notes: early.reduce(applyNotesChange, notes), loaded: true });
    });
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [workId]);

  return state.workId === workId
    ? { notes: state.notes, loaded: state.loaded }
    : { notes: NONE, loaded: false };
}

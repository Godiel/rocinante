import type { CoreNotifications, Note } from "../../bridge/generated/protocol";

export type NotesChange = CoreNotifications["notes.changed"];

/**
 * The notes after a change announced by the core: `notes` are shown as they are now, `removed` stopped
 * being shown. Nothing changed gives back the same list, so what depends on it need not be redone.
 */
export function applyNotesChange(notes: readonly Note[], change: NotesChange): Note[] {
  if (change.notes.length === 0 && change.removed.length === 0) return notes as Note[];
  const gone = new Set(change.removed);
  const now = new Map(change.notes.map((note) => [note.id, note]));
  const kept = notes.filter((note) => !gone.has(note.id)).map((note) => now.get(note.id) ?? note);
  const known = new Set(kept.map((note) => note.id));
  const added = change.notes.filter((note) => !known.has(note.id) && !gone.has(note.id));
  return [...kept, ...added];
}

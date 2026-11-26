import type { Note } from "../../bridge/generated/protocol";
import { folded } from "../elements/search";

/**
 * What a note is attached to: a document (anchored in its text, or loose in it once its passage went) or
 * nothing, as a loose idea of the work.
 */
export type NoteClass = "text" | "idea" | "elements";

export interface NoteFilter {
  /** In the text, loose ideas, or linked with fichas; null for all. */
  kind: NoteClass | null;
  /** Only the notes of this document. */
  documentId: string | null;
  /** Only the notes linked with this ficha. */
  elementId: string | null;
  /** Words to find in the text of the notes. */
  query: string;
  /** Whether resolved notes are shown too. */
  resolved: boolean;
}

export const ALL_NOTES: NoteFilter = {
  kind: null,
  documentId: null,
  elementId: null,
  query: "",
  resolved: false,
};

export function isIdea(note: Pick<Note, "documentId">): boolean {
  return note.documentId === null;
}

/** Whether a note is in the given class. A note can be in the text and linked with fichas at once. */
export function inClass(note: Note, kind: NoteClass): boolean {
  switch (kind) {
    case "text":
      return note.documentId !== null;
    case "idea":
      return note.documentId === null;
    case "elements":
      return note.elements.length > 0;
  }
}

/** Whether the words of the query are all in the note, in any order, ignoring case and accents. */
export function noteMatches(note: Pick<Note, "text">, query: string): boolean {
  const words = folded(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = folded(note.text);
  return words.every((word) => text.includes(word));
}

/** The notes that pass every part of the filter. Links with fichas in `hidden` (in the trash) do not count. */
export function filterNotes(
  notes: readonly Note[],
  filter: NoteFilter,
  hidden: ReadonlySet<string> = new Set(),
): Note[] {
  return notes.filter((note) => {
    const elements = note.elements.filter((id) => !hidden.has(id));
    const shown = elements.length === note.elements.length ? note : { ...note, elements };
    return (
      (filter.resolved || note.resolvedAt === null) &&
      (filter.kind === null || inClass(shown, filter.kind)) &&
      (filter.documentId === null || note.documentId === filter.documentId) &&
      (filter.elementId === null || elements.includes(filter.elementId)) &&
      noteMatches(note, filter.query)
    );
  });
}

const newestFirst = (a: Note, b: Note) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

const oldestFirst = (a: Note, b: Note) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/**
 * The newest notes first. With `inTextOrder`, as when the list shows one chapter: the anchored ones in the
 * order of the text, then those whose passage went, oldest first.
 */
export function orderNotes(notes: readonly Note[], inTextOrder = false): Note[] {
  if (!inTextOrder) return [...notes].sort(newestFirst);
  return [...notes].sort((a, b) => {
    if (a.order !== null && b.order !== null) return a.order - b.order || oldestFirst(a, b);
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    return oldestFirst(a, b);
  });
}

/** The notes of one document as the editor wants them: in the order they were written. */
export function notesOf(notes: readonly Note[], documentId: string): Note[] {
  return notes.filter((note) => note.documentId === documentId).sort(oldestFirst);
}

/** The beginning of a note, on one line, for a list. */
export function preview(note: Pick<Note, "text">, length = 140): string {
  const line = note.text.replace(/\s+/g, " ").trim();
  return line.length <= length ? line : `${line.slice(0, length - 1).trimEnd()}…`;
}

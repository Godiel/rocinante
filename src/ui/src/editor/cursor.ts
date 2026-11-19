/**
 * Where the writer's cursor is, in which document. The page view opens on the page of the cursor.
 * It asks the open editor at that moment, rather than keeping a copy from the last selection event:
 * the place saved in the core lags a second behind, and events may not have arrived yet.
 */
export interface Cursor {
  documentId: string;
  /** ProseMirror position of the head of the selection. */
  position: number;
}

type Read = () => Cursor | null;

let reader: Read | null = null;

/** The open editor says how to read its cursor. Returns the way to stop. */
export function registerCursor(read: Read): () => void {
  reader = read;
  return () => {
    if (reader === read) reader = null;
  };
}

export function currentCursor(): Cursor | null {
  return reader?.() ?? null;
}

/**
 * Where the writer's cursor is now, in which document. The page view opens on the page of the
 * cursor; the place saved in the core lags a second behind, this does not.
 */
export interface Cursor {
  documentId: string;
  /** ProseMirror position of the head of the selection. */
  position: number;
}

let current: Cursor | null = null;

export function rememberCursor(cursor: Cursor): void {
  current = cursor;
}

export function currentCursor(): Cursor | null {
  return current;
}

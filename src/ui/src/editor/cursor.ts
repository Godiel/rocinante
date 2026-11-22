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

/** What `shownHead` needs of a ProseMirror view. */
interface ShownView {
  readonly dom: HTMLElement;
  hasFocus(): boolean;
  posAtDOM(node: Node, offset: number): number;
}

/**
 * The head of the selection as it shows on screen, if the text has the keyboard; null otherwise.
 * The editor's own state can lag a click by a moment, and the writer means what they see.
 */
export function shownHead(view: ShownView): number | null {
  const selection = view.dom.ownerDocument.getSelection();
  const node = selection?.focusNode;
  if (!view.hasFocus() || !node || !view.dom.contains(node)) return null;
  try {
    return view.posAtDOM(node, selection.focusOffset);
  } catch {
    // A point the view cannot place, such as inside a widget: the editor's state will do.
    return null;
  }
}

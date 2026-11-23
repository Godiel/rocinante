/** Ctrl+Mayús+E (⌘+Mayús+E on a Mac) opens and closes the fichas beside the text, whatever the keyboard layout. */
export function isElementsShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === "KeyE"
  );
}

const KEY = "rocinante-elements-panel";

/**
 * Whether the panel was open in this window. Each window keeps its own: the session storage of a webview
 * belongs to its window and lasts while it does.
 */
export function panelWasOpen(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "open";
  } catch {
    return false;
  }
}

export function rememberPanel(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(KEY, "open");
    else sessionStorage.removeItem(KEY);
  } catch {
    // Without storage the panel simply starts closed next time.
  }
}

/** The name a ficha takes from the selected text: on one line, without the spaces around it. */
export function nameFromSelection(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

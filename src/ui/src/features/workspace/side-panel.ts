/** What the panel beside the text shows: the fichas of the work, its notes or the squire. */
export type SideTab = "elements" | "notes" | "squire";

/** Ctrl+Mayús+N (⌘+Mayús+N on a Mac) opens and closes the notes beside the text, whatever the layout. */
export function isNotesShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === "KeyN"
  );
}

const KEY = "rocinante-side-panel";
/** Where the panel of the fichas was remembered before it had tabs. */
const BEFORE_TABS = "rocinante-elements-panel";

/**
 * The tab the panel was open at in this window, or null if it was closed. Each window keeps its own: the
 * session storage of a webview belongs to its window and lasts while it does.
 */
export function rememberedSidePanel(): SideTab | null {
  try {
    const tab = sessionStorage.getItem(KEY);
    if (tab === "elements" || tab === "notes" || tab === "squire") return tab;
    return sessionStorage.getItem(BEFORE_TABS) === "open" ? "elements" : null;
  } catch {
    return null;
  }
}

export function rememberSidePanel(tab: SideTab | null): void {
  try {
    sessionStorage.removeItem(BEFORE_TABS);
    if (tab) sessionStorage.setItem(KEY, tab);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Without storage the panel simply starts closed next time.
  }
}

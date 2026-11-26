/** Ctrl+Mayús+E (⌘+Mayús+E on a Mac) opens and closes the fichas beside the text, whatever the keyboard layout. */
export function isElementsShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === "KeyE"
  );
}

/** The name a ficha takes from the selected text: on one line, without the spaces around it. */
export function nameFromSelection(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Ctrl+Mayús+I (⌘+Mayús+I on a Mac) opens and closes the index, whatever the keyboard layout. */
export function isOutlineShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.code === "KeyI"
  );
}

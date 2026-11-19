/** F6 opens and closes the versions: the F keys are kept for the large parts of Rocinante. */
export function isVersionsShortcut(event: KeyboardEvent): boolean {
  return event.key === "F6" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/** Ctrl+S (⌘+S on a Mac): everything is saved already, so out of habit it keeps a version. */
export function isSaveVersionShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.code === "KeyS"
  );
}

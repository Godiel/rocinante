const plain = (event: KeyboardEvent) =>
  !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

/** F11: focus mode, the full screen of every app, as the big views have their F keys (F5, F6). */
export function isFocusShortcut(event: KeyboardEvent): boolean {
  return event.key === "F11" && plain(event);
}

/** Escape leaves focus mode, once nothing smaller on the page wanted it. */
export function isLeaveFocusKey(event: KeyboardEvent): boolean {
  return event.key === "Escape" && plain(event);
}

/** F5: the page view, the second of the big views on the F keys after the versions (F6). */
export function isPageViewShortcut(event: KeyboardEvent): boolean {
  return event.key === "F5" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

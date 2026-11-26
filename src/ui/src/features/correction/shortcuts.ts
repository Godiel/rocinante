/** F7 shows and hides the marks of the correction, as in word processors. */
export function isCorrectionShortcut(event: KeyboardEvent): boolean {
  return event.key === "F7" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

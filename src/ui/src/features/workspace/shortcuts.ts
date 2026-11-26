/** F2 goes between the writing and the board: the F keys are kept for the large parts of Rocinante. */
export function isTabShortcut(event: KeyboardEvent): boolean {
  return event.key === "F2" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/** F8 goes between the writing and the threads of fate. */
export function isThreadsShortcut(event: KeyboardEvent): boolean {
  return event.key === "F8" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

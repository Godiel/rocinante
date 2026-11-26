/** F9 opens the export: a large part of Rocinante, so it has an F key. */
export function isExportShortcut(event: KeyboardEvent): boolean {
  return event.key === "F9" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

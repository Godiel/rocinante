/**
 * What scrolls the page: the root of the app, under the title bar, not the window, so its scrollbar starts
 * below the bar (tokens.css). Without it, as in a test, the document.
 */
export function pageScroller(): HTMLElement {
  return document.getElementById("root") ?? document.documentElement;
}

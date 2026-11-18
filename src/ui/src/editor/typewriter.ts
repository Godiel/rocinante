// Geometry of the typewriter: where the line being written should sit, and where to draw the
// caret. Pure functions over rectangles, so they can be tested without a browser.

/** Height of the eyes, as a fraction of the window, where the active line stays while writing. */
export const EYE_LINE = 0.42;

/** Below this many pixels the page does not move, so typing within a line never shakes it. */
const STILL = 2;

export interface CaretCoords {
  top: number;
  bottom: number;
  left: number;
}

/**
 * How far to scroll so the caret's line sits at the height of the eyes: positive scrolls the
 * page up (the paper rises, as with a typewriter's platen), zero leaves it still.
 */
export function platenScroll(
  caret: CaretCoords,
  viewportHeight: number,
  eyeLine = EYE_LINE,
): number {
  const middle = (caret.top + caret.bottom) / 2;
  const delta = middle - viewportHeight * eyeLine;
  return Math.abs(delta) < STILL ? 0 : Math.round(delta);
}

export interface CaretBox {
  top: number;
  left: number;
  height: number;
}

/** The caret as a box inside its container, from viewport coordinates of both. */
export function caretBox(caret: CaretCoords, container: { top: number; left: number }): CaretBox {
  return {
    top: Math.round(caret.top - container.top),
    left: Math.round(caret.left - container.left),
    height: Math.max(1, Math.round(caret.bottom - caret.top)),
  };
}

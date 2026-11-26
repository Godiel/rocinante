// DOM matchers for component tests (toBeInTheDocument, toHaveTextContent…).
import "@testing-library/jest-dom/vitest";

// jsdom lays nothing out. ProseMirror measures the selection to scroll it into view when an editor takes
// the keyboard; without these it throws outside the test that focused it.
if (typeof window !== "undefined") {
  const noRects = () => [] as unknown as DOMRectList;
  const emptyRect = () => new DOMRect(0, 0, 0, 0);
  for (const prototype of [Element.prototype, Range.prototype]) {
    prototype.getClientRects ??= noRects;
    prototype.getBoundingClientRect ??= emptyRect;
  }
  document.elementFromPoint ??= () => null;
}

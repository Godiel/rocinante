import type { Cursor } from "../../editor/cursor";
import type { BookChapter } from "./blocks";
import type { MeasuredBlock, Page } from "./layout";

/**
 * The page where the cursor is, as an index into `pages`. The line within a paragraph is
 * estimated from how far into it the cursor is: close enough to land on the right page. A cursor
 * in a fragment, which is not part of the book, finds the first page.
 */
export function pageOfCursor(
  pages: Page[],
  chapters: BookChapter[],
  measured: MeasuredBlock[][],
  cursor: Cursor | null,
): number {
  const chapter = cursor ? chapters.findIndex((each) => each.id === cursor.documentId) : -1;
  if (!cursor || chapter < 0) return 0;

  const ranges = chapters[chapter]!.ranges;
  let block = ranges.findIndex((range) => range && cursor.position < range.to);
  if (block < 0) block = ranges.length - 1;
  const range = ranges[block];
  const lines = measured[chapter]?.[block]?.lines.length ?? 1;
  const into = range ? (cursor.position - range.from) / Math.max(1, range.to - range.from) : 0;
  const line = Math.min(lines - 1, Math.max(0, Math.floor(into * lines)));

  const found = pages.findIndex((page) =>
    page.slices.some(
      (slice) =>
        slice.chapter === chapter && slice.block === block && slice.from <= line && line < slice.to,
    ),
  );
  if (found >= 0) return found;
  return Math.max(
    0,
    pages.findIndex((page) => page.chapter === chapter),
  );
}

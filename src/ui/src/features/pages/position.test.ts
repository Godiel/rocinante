import { describe, expect, it } from "vitest";
import type { BookChapter } from "./blocks";
import type { MeasuredBlock, Page } from "./layout";
import { pageOfCursor } from "./position";

const block = (lines: number): MeasuredBlock => ({
  spaceBefore: 0,
  lines: Array.from({ length: lines }, () => 10),
  unbreakable: false,
  keepWithNext: false,
  footnotes: [],
});

// Chapter «uno»: its title and a paragraph of 20 lines (positions 0–200), cut after line 8.
// Chapter «dos»: its title and a short paragraph.
const chapters = [
  { id: "uno", ranges: [null, { from: 0, to: 200 }] },
  { id: "dos", ranges: [null, { from: 0, to: 30 }] },
] as BookChapter[];
const measured = [
  [block(1), block(20)],
  [block(1), block(2)],
];
const pages: Page[] = [
  {
    number: 1,
    chapter: 0,
    opensChapter: true,
    slices: [
      { chapter: 0, block: 0, from: 0, to: 1 },
      { chapter: 0, block: 1, from: 0, to: 8 },
    ],
    notes: [],
  },
  {
    number: 2,
    chapter: 0,
    opensChapter: false,
    slices: [{ chapter: 0, block: 1, from: 8, to: 20 }],
    notes: [],
  },
  {
    number: 3,
    chapter: 1,
    opensChapter: true,
    slices: [
      { chapter: 1, block: 0, from: 0, to: 1 },
      { chapter: 1, block: 1, from: 0, to: 2 },
    ],
    notes: [],
  },
];

describe("the page of the cursor", () => {
  it("is the page that holds its line", () => {
    expect(pageOfCursor(pages, chapters, measured, { documentId: "uno", position: 10 })).toBe(0);
    expect(pageOfCursor(pages, chapters, measured, { documentId: "uno", position: 150 })).toBe(1);
    expect(pageOfCursor(pages, chapters, measured, { documentId: "dos", position: 5 })).toBe(2);
  });

  it("at the very end of a chapter is its last page", () => {
    expect(pageOfCursor(pages, chapters, measured, { documentId: "uno", position: 200 })).toBe(1);
  });

  it("in a fragment, or with no cursor at all, is the first page", () => {
    expect(pageOfCursor(pages, chapters, measured, { documentId: "fragmento", position: 3 })).toBe(
      0,
    );
    expect(pageOfCursor(pages, chapters, measured, null)).toBe(0);
  });
});

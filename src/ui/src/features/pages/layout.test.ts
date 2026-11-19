import { describe, expect, it } from "vitest";
import { layout, type LayoutOptions, type MeasuredBlock, type Page } from "./layout";

// A made-up page: ten lines of 10 in the text area.
const options: LayoutOptions = { textHeight: 100, chapterSink: 30, footnoteRule: 5 };

function paragraph(lines: number, footnotes: MeasuredBlock["footnotes"] = []): MeasuredBlock {
  return {
    spaceBefore: 0,
    lines: Array.from({ length: lines }, () => 10),
    unbreakable: false,
    keepWithNext: false,
    footnotes,
  };
}

function title(): MeasuredBlock {
  return { spaceBefore: 10, lines: [20], unbreakable: true, keepWithNext: true, footnotes: [] };
}

function sceneBreak(): MeasuredBlock {
  return { spaceBefore: 0, lines: [20], unbreakable: true, keepWithNext: false, footnotes: [] };
}

/** Each page as «block:from-to» slices, to read the layout at a glance. */
const shape = (pages: Page[]) =>
  pages.map((page) =>
    page.slices.map((slice) => `${slice.block}:${slice.from}-${slice.to}`).join(" "),
  );

describe("pages of a book", () => {
  it("numbers its pages and starts every chapter on a new one, lowered", () => {
    const pages = layout([[paragraph(3)], [paragraph(2)]], options);

    expect(pages.map((page) => [page.number, page.chapter, page.opensChapter])).toEqual([
      [1, 0, true],
      [2, 1, true],
    ]);
  });

  it("cuts a long paragraph between lines", () => {
    // 7 lines fit under the sink of the first page; the other 8 go to the next.
    expect(shape(layout([[paragraph(15)]], options))).toEqual(["0:0-7", "0:7-15"]);
  });

  it("never leaves the first line of a paragraph alone at the foot of a page", () => {
    // 6 lines, then a paragraph of which only one line would fit: it goes whole to the next page.
    expect(shape(layout([[paragraph(6), paragraph(4)]], options))).toEqual(["0:0-6", "1:0-4"]);
  });

  it("never carries the last line of a paragraph alone to the next page", () => {
    // 8 lines of 9 would fit under the sink: one goes back so two go together.
    expect(shape(layout([[paragraph(8)]], { ...options, chapterSink: 0, textHeight: 70 }))).toEqual(
      ["0:0-6", "0:6-8"],
    );
  });

  it("never leaves a title alone at the foot of a page", () => {
    // After 5 lines there is room for the title, but not for two lines of what follows it.
    const pages = layout([[paragraph(5), title(), paragraph(4)]], options);

    expect(shape(pages)).toEqual(["0:0-5", "1:0-1 2:0-4"]);
  });

  it("drops the space above a block that opens a page", () => {
    const pages = layout([[paragraph(7), { ...paragraph(3), spaceBefore: 6 }]], options);

    // 7 lines and the sink fill the page; the next page starts with the paragraph, without space.
    expect(shape(pages)).toEqual(["0:0-7", "1:0-3"]);
  });

  it("keeps a scene break whole", () => {
    // Under the sink, 6 lines leave 10: not enough for the break, which goes whole to the next page.
    expect(shape(layout([[paragraph(6), sceneBreak(), paragraph(2)]], options))).toEqual([
      "0:0-6",
      "1:0-1 2:0-2",
    ]);
  });

  it("puts a footnote at the foot of the page where it is called, numbered in its chapter", () => {
    const pages = layout(
      [
        [paragraph(3, [{ line: 1, lines: [8, 8] }]), paragraph(2, [{ line: 0, lines: [8] }])],
        [paragraph(2, [{ line: 0, lines: [8] }])],
      ],
      { ...options, chapterSink: 0 },
    );

    expect(pages[0]!.notes).toEqual([
      { chapter: 0, number: 1, from: 0, to: 2 },
      { chapter: 0, number: 2, from: 0, to: 1 },
    ]);
    expect(pages[1]!.notes).toEqual([{ chapter: 1, number: 1, from: 0, to: 1 }]);
  });

  it("makes room for the notes, so the text that does not fit moves on", () => {
    // 3 lines with a note of 3 lines (and the rule): only 3 more lines of text fit.
    const pages = layout([[paragraph(3, [{ line: 0, lines: [10, 10, 10] }]), paragraph(6)]], {
      ...options,
      chapterSink: 0,
    });

    expect(shape(pages)).toEqual(["0:0-3 1:0-3", "1:3-6"]);
  });

  it("goes on with a note too long for its page at the foot of the next", () => {
    const pages = layout([[paragraph(6, [{ line: 5, lines: [10, 10, 10, 10] }]), paragraph(4)]], {
      ...options,
      chapterSink: 0,
    });

    // The call is on line 6 of 10: 3 lines of the note fit, the fourth waits for page 2.
    expect(pages[0]!.notes).toEqual([{ chapter: 0, number: 1, from: 0, to: 3 }]);
    expect(pages[1]!.notes).toEqual([{ chapter: 0, number: 1, from: 3, to: 4 }]);
    expect(shape(pages)).toEqual(["0:0-6", "1:0-4"]);
  });

  it("a note left over at the end of a chapter goes on its pages before the next chapter", () => {
    const pages = layout(
      [[paragraph(9, [{ line: 8, lines: Array.from({ length: 12 }, () => 10) }])], [paragraph(1)]],
      { ...options, chapterSink: 0 },
    );

    // The last line with its call cannot go alone: two lines move on, and the note with them.
    expect(shape(pages)).toEqual(["0:0-7", "0:7-9", "", "0:0-1"]);
    expect(pages.map((page) => [page.chapter, page.notes.map((n) => `${n.from}-${n.to}`)])).toEqual(
      [
        [0, []],
        [0, ["0-7"]],
        [0, ["7-12"]],
        [1, []],
      ],
    );
  });

  it("a block taller than a page still goes, on a page of its own", () => {
    const tall: MeasuredBlock = { ...sceneBreak(), lines: [150] };

    expect(shape(layout([[paragraph(2), tall, paragraph(1)]], options))).toEqual([
      "0:0-2",
      "1:0-1",
      "2:0-1",
    ]);
  });

  it("an empty book has no pages, and an empty chapter still has its own", () => {
    expect(layout([], options)).toEqual([]);
    expect(layout([[], [paragraph(1)]], options).map((page) => page.chapter)).toEqual([0, 1]);
  });
});

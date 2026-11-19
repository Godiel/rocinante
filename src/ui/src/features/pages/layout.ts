/**
 * The paginator: shares the measured blocks of a book out among its pages.
 *
 * It only works with numbers. Somebody else measures (measure.ts uses the browser; the tests use
 * made-up heights) and somebody else draws (the page view). So the rules of a printed book can be
 * tested without a browser:
 *
 * - every chapter starts on a new page, its title lowered by `chapterSink`;
 * - a paragraph may be cut between lines, but never leaving a single line at the foot of a page
 *   (an orphan) or at the head of the next one (a widow);
 * - a title is never left alone at the foot of a page: it goes with at least two lines of what
 *   follows;
 * - a footnote goes at the foot of the page where it is called. A note too long for what is left
 *   goes on at the foot of the next page, as printers do.
 */

/** A block of a chapter (a paragraph, a title, a scene break) as measured at the width of the page. */
export interface MeasuredBlock {
  /** Space above the block; dropped when the block opens a page. */
  spaceBefore: number;
  /** Height of each line, in reading order. */
  lines: number[];
  /** Cannot be cut between lines: titles, scene breaks, lists. */
  unbreakable: boolean;
  /** Must share its page with the start of the next block: titles. */
  keepWithNext: boolean;
  /** Footnotes called from this block, in reading order: the line of the call and their own lines. */
  footnotes: MeasuredFootnote[];
}

export interface MeasuredFootnote {
  /** Index of the line of the block where the call is. */
  line: number;
  /** Height of each line of the text of the note. */
  lines: number[];
}

export interface LayoutOptions {
  /** Height of the text area of a page: the page less its top and bottom margins. */
  textHeight: number;
  /** How far down the first page of a chapter its title starts. */
  chapterSink: number;
  /** Room taken by the rule above the footnotes of a page. */
  footnoteRule: number;
}

/** The lines `from`…`to` (excluded) of a block, on a page. */
export interface BlockSlice {
  chapter: number;
  block: number;
  from: number;
  to: number;
}

/** The lines `from`…`to` (excluded) of a footnote, at the foot of a page. */
export interface NoteSlice {
  chapter: number;
  /** Numbered from 1 in each chapter, in reading order. */
  number: number;
  from: number;
  to: number;
}

export interface Page {
  /** From 1. */
  number: number;
  chapter: number;
  /** The first page of its chapter. */
  opensChapter: boolean;
  slices: BlockSlice[];
  notes: NoteSlice[];
}

const sum = (heights: number[]) => heights.reduce((total, height) => total + height, 0);

/** Lines kept together at either side of a cut, and after a title. */
const KEEP = 2;

interface PendingNote {
  slice: Omit<NoteSlice, "to">;
  lines: number[];
}

export function layout(chapters: MeasuredBlock[][], options: LayoutOptions): Page[] {
  const pages: Page[] = [];
  let page!: Page;
  let used = 0; // height taken by the text
  let notesUsed = 0; // height taken by the notes, rule included
  let carried: PendingNote[] = []; // notes that did not fit on the page before

  const room = () => options.textHeight - used - notesUsed;

  function newPage(chapter: number, opensChapter: boolean) {
    page = { number: pages.length + 1, chapter, opensChapter, slices: [], notes: [] };
    pages.push(page);
    used = opensChapter ? options.chapterSink : 0;
    notesUsed = 0;
    const waiting = carried;
    carried = [];
    for (const note of waiting) placeNote(note);
  }

  /**
   * Puts as much of a note as the page allows at its foot; the rest waits for the next page. At
   * least one line goes, so the reader finds the note on the page where it is called.
   */
  function placeNote(note: PendingNote) {
    const rule = page.notes.length === 0 ? options.footnoteRule : 0;
    let count = 0;
    let height = rule;
    while (count < note.lines.length && height + note.lines[count]! <= room()) {
      height += note.lines[count]!;
      count += 1;
    }
    count = Math.max(1, count);
    page.notes.push({ ...note.slice, to: note.slice.from + count });
    notesUsed += rule + sum(note.lines.slice(0, count));
    if (count < note.lines.length) {
      carried.push({
        slice: { ...note.slice, from: note.slice.from + count },
        lines: note.lines.slice(count),
      });
    }
  }

  /** Height the notes called from a line need, rule included, if all of them go on this page. */
  function notesOf(notes: MeasuredFootnote[], line: number): number {
    const called = notes.filter((note) => note.line === line);
    if (called.length === 0) return 0;
    const rule = page.notes.length === 0 ? options.footnoteRule : 0;
    return rule + sum(called.map((note) => sum(note.lines)));
  }

  /** How many lines of a block, from `start`, fit on this page with their notes. */
  function fitting(block: MeasuredBlock, start: number, space: number): number {
    let height = space;
    let count = 0;
    for (let line = start; line < block.lines.length; line += 1) {
      height += block.lines[line]!;
      // At least the first line of each note must come along with its call.
      const notes = block.footnotes.filter((note) => note.line === line);
      const firstLines = notes.length
        ? (page.notes.length === 0 ? options.footnoteRule : 0) + sum(notes.map((n) => n.lines[0]!))
        : 0;
      if (height + firstLines > room()) break;
      count += 1;
    }
    return count;
  }

  chapters.forEach((blocks, chapter) => {
    newPage(chapter, true);
    let number = 0; // footnotes of the chapter so far

    blocks.forEach((block, index) => {
      const next = blocks[index + 1];
      let start = 0;

      while (start < block.lines.length) {
        const atTop = page.slices.length === 0;
        const space = atTop ? 0 : block.spaceBefore;
        const remaining = block.lines.length - start;

        let count: number;
        if (block.unbreakable || block.keepWithNext) {
          const needed =
            space +
            sum(block.lines) +
            notesOf(block.footnotes, 0) +
            (block.keepWithNext && next ? next.spaceBefore + sum(next.lines.slice(0, KEEP)) : 0);
          count = needed <= room() || atTop ? remaining : 0;
        } else {
          const fit = fitting(block, start, space);
          count = Math.min(fit, remaining);
          if (count < remaining) {
            // No single line left behind at the foot (orphan) or carried to the head (widow).
            if (start === 0 && count < KEEP) count = 0;
            if (remaining - count < KEEP && count > 0) count = Math.max(0, remaining - KEEP);
            if (start === 0 && count < KEEP) count = 0;
          }
          // A page with nothing on it takes what it can, or the book would never end.
          if (count === 0 && atTop) count = Math.max(1, Math.min(fit, remaining));
        }

        if (count === 0) {
          newPage(chapter, false);
          continue;
        }

        used += space + sum(block.lines.slice(start, start + count));
        page.slices.push({ chapter, block: index, from: start, to: start + count });
        for (const note of block.footnotes) {
          if (note.line < start || note.line >= start + count) continue;
          number += 1;
          placeNote({ slice: { chapter, number, from: 0 }, lines: note.lines });
        }

        start += count;
        if (start < block.lines.length) newPage(chapter, false);
      }
    });

    // The notes of a chapter end with it: what is left goes on pages of its own.
    while (carried.length > 0) newPage(chapter, false);
  });

  return pages;
}

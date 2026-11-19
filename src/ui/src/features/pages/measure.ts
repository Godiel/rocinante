import type { WorkFormat } from "../../bridge/generated/protocol";
import { TYPEFACES } from "../../design/typefaces";
import { workClasses } from "../format/work-style";
import type { BookChapter } from "./blocks";
import type { LayoutOptions, MeasuredBlock } from "./layout";
import "./pages.css";

/** CSS pixels: 96 to the inch. */
export const PX_PER_MM = 96 / 25.4;
export const PX_PER_PT = 96 / 72;

/** Where the first page of a chapter starts its title: a quarter of the way down, as in many novels. */
const CHAPTER_SINK = 0.25;

/** The measures of a page of the work, in CSS pixels at real size. */
export interface PageGeometry {
  width: number;
  height: number;
  top: number;
  bottom: number;
  inside: number;
  outside: number;
  textWidth: number;
  textHeight: number;
  /** The body of the text, in pixels. */
  body: number;
}

export function geometryOf(format: WorkFormat): PageGeometry {
  const mm = (value: number) => value * PX_PER_MM;
  const { margins } = format;
  return {
    width: mm(format.pageWidth),
    height: mm(format.pageHeight),
    top: mm(margins.top),
    bottom: mm(margins.bottom),
    inside: mm(margins.inside),
    outside: mm(margins.outside),
    textWidth: mm(format.pageWidth - margins.inside - margins.outside),
    textHeight: mm(format.pageHeight - margins.top - margins.bottom),
    body: format.bodySize * PX_PER_PT,
  };
}

/** The CSS of the text of the pages, shared by the measuring column and the pages themselves. */
export function textStyle(
  format: WorkFormat,
  geometry: PageGeometry,
): Partial<CSSStyleDeclaration> {
  return {
    width: `${geometry.textWidth}px`,
    fontFamily: TYPEFACES[format.typeface].family,
    fontSize: `${geometry.body}px`,
    lineHeight: String(format.leading),
  };
}

export function textClasses(format: WorkFormat): string {
  return `page-text ${workClasses(format)}`;
}

const UNBREAKABLE = new Set(["H1", "H2", "H3", "HR", "UL", "OL", "BLOCKQUOTE"]);
const TITLES = new Set(["H1", "H2", "H3"]);

/**
 * Sets the whole book in a hidden column the width of the text area, at real size and with the
 * typeface of the work, and reads every block in one pass: the browser lays the text out once.
 * Paragraphs are measured in lines of the leading; titles and scene breaks as one piece.
 */
export function measureBook(
  chapters: BookChapter[],
  format: WorkFormat,
  host: HTMLElement,
): { blocks: MeasuredBlock[][]; options: LayoutOptions } {
  const geometry = geometryOf(format);
  const column = host.ownerDocument.createElement("div");
  column.className = `${textClasses(format)} page-measure`;
  Object.assign(column.style, textStyle(format, geometry));

  const wrappers = chapters.map((chapter) => {
    const blocks = chapter.blocks.map((block) => {
      const wrapper = host.ownerDocument.createElement("div");
      wrapper.className = "page-block";
      wrapper.append(block.cloneNode(true));
      column.append(wrapper);
      return wrapper;
    });
    const notes = chapter.footnotes.map((text, index) => {
      const note = host.ownerDocument.createElement("p");
      note.className = "page-footnote";
      note.dataset.number = String(index + 1);
      note.textContent = text;
      column.append(note);
      return note;
    });
    return { blocks, notes };
  });
  host.append(column);

  try {
    const line = geometry.body * format.leading;
    const noteLine =
      parseFloat(getComputedStyle(column.querySelector(".page-footnote") ?? column).lineHeight) ||
      line;

    const measured = wrappers.map(({ blocks, notes }) => {
      const noteLines = notes.map((note) => {
        const height = note.getBoundingClientRect().height;
        const count = Math.max(1, Math.round(height / noteLine));
        return Array.from({ length: count }, () => height / count);
      });
      let called = 0;

      return blocks.map((wrapper): MeasuredBlock => {
        const element = wrapper.firstElementChild as HTMLElement;
        const style = getComputedStyle(element);
        const spaceBefore = parseFloat(style.marginTop) || 0;
        const spaceAfter = parseFloat(style.marginBottom) || 0;
        const box = element.getBoundingClientRect();
        const unbreakable = UNBREAKABLE.has(element.tagName);
        const count = unbreakable ? 1 : Math.max(1, Math.round(box.height / line));
        const each = box.height / count;
        const lines = Array.from({ length: count }, () => each);
        lines[count - 1]! += spaceAfter;

        const footnotes = [...element.querySelectorAll<HTMLElement>("sup.footnote")].map((call) => {
          const at = Math.floor((call.getBoundingClientRect().top - box.top) / each);
          called += 1;
          return {
            line: Math.min(count - 1, Math.max(0, at)),
            lines: noteLines[called - 1] ?? [noteLine],
          };
        });

        return {
          spaceBefore,
          lines,
          unbreakable,
          keepWithNext: TITLES.has(element.tagName),
          footnotes,
        };
      });
    });

    return {
      blocks: measured,
      options: {
        textHeight: geometry.textHeight,
        chapterSink: geometry.textHeight * CHAPTER_SINK,
        footnoteRule: noteLine,
      },
    };
  } finally {
    column.remove();
  }
}

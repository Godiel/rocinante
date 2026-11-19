import { useLayoutEffect, useRef } from "react";
import type { WorkFormat } from "../../bridge/generated/protocol";
import type { BookChapter } from "./blocks";
import type { LayoutOptions, MeasuredBlock, Page } from "./layout";
import { textClasses, textStyle, type PageGeometry } from "./measure";

const sum = (heights: number[]) => heights.reduce((total, height) => total + height, 0);

/** The book once composed: what was set, what was measured, and how it was shared out. */
export interface ComposedBook {
  chapters: BookChapter[];
  measured: MeasuredBlock[][];
  options: LayoutOptions;
  pages: Page[];
  geometry: PageGeometry;
}

/**
 * Some lines of a set element: the whole element, drawn in a window the height of those lines and
 * moved up to the first of them. The text is composed exactly as it was measured.
 */
function Lines({
  source,
  lines,
  from,
  to,
  spaceBefore,
}: {
  source: HTMLElement;
  lines: number[];
  from: number;
  to: number;
  spaceBefore: number;
}) {
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const copy = source.cloneNode(true) as HTMLElement;
    copy.style.margin = "0";
    inner.current?.replaceChildren(copy);
  }, [source]);

  return (
    <div
      className="page-lines"
      style={{ height: sum(lines.slice(from, to)), marginTop: spaceBefore }}
    >
      <div ref={inner} className="page-block" style={{ marginTop: -sum(lines.slice(0, from)) }} />
    </div>
  );
}

function footnote(chapter: BookChapter, number: number): HTMLElement {
  const note = document.createElement("p");
  note.className = "page-footnote";
  note.dataset.number = String(number);
  note.textContent = chapter.footnotes[number - 1] ?? "";
  return note;
}

export interface PageSheetProps {
  page: Page;
  book: ComposedBook;
  format: WorkFormat;
  /** Lines of each footnote, by chapter: notes[chapter][number - 1]. */
  notes: number[][][];
}

/**
 * One page of the book at real size: the text in its box, the footnotes at its foot and its
 * number. Odd pages are on the right of the spine, so their inside margin is on the left.
 */
export function PageSheet({ page, book, format, notes }: PageSheetProps) {
  const { geometry, chapters, measured, options } = book;
  const recto = page.number % 2 === 1;
  const notesHeight =
    page.notes.length > 0
      ? options.footnoteRule +
        sum(
          page.notes.map((note) =>
            sum(notes[note.chapter]![note.number - 1]!.slice(note.from, note.to)),
          ),
        )
      : 0;

  return (
    <div
      className="page-sheet"
      role="img"
      aria-label={`Página ${page.number}`}
      style={{ width: geometry.width, height: geometry.height }}
    >
      <div
        className={textClasses(format)}
        style={{
          ...textStyle(format, geometry),
          position: "absolute",
          top: geometry.top,
          left: recto ? geometry.inside : geometry.outside,
          height: geometry.textHeight,
          paddingTop: page.opensChapter ? options.chapterSink : 0,
          boxSizing: "border-box",
        }}
      >
        {page.slices.map((slice, index) => {
          const block = measured[slice.chapter]![slice.block]!;
          return (
            <Lines
              key={`${slice.chapter}:${slice.block}:${slice.from}`}
              source={chapters[slice.chapter]!.blocks[slice.block]!}
              lines={block.lines}
              from={slice.from}
              to={slice.to}
              spaceBefore={index > 0 && slice.from === 0 ? block.spaceBefore : 0}
            />
          );
        })}
        {page.notes.length > 0 && (
          <div className="page-notes" style={{ height: notesHeight }}>
            <div className="page-notes-rule" style={{ height: options.footnoteRule }} />
            {page.notes.map((note) => (
              <Lines
                key={`${note.chapter}:${note.number}:${note.from}`}
                source={footnote(chapters[note.chapter]!, note.number)}
                lines={notes[note.chapter]![note.number - 1]!}
                from={note.from}
                to={note.to}
                spaceBefore={0}
              />
            ))}
          </div>
        )}
      </div>
      <span
        className="page-number"
        style={{
          bottom: geometry.bottom / 2,
          fontFamily: textStyle(format, geometry).fontFamily,
          fontSize: geometry.body * 0.9,
        }}
      >
        {page.number}
      </span>
    </div>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { request } from "../../bridge/core";
import type { WorkFormat } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { currentCursor } from "../../editor/cursor";
import { savePendingNow } from "../../editor/pending-saves";
import { chapterBlocks } from "./blocks";
import { layout } from "./layout";
import { geometryOf, measureBook } from "./measure";
import { PageSheet, type ComposedBook } from "./PageSheet";
import { pageOfCursor } from "./position";
import "./pages.css";

/** Room around the pages and between two rows of them, in pixels. */
const GAP = 32;
/** Rows drawn above and below those in sight, so scrolling never shows a blank. */
const SPARE_ROWS = 2;

/** Pages as they are seen: one by one, or two facing like an open book, the first on the right. */
function rowsOf(pages: number, facing: boolean): number[][] {
  if (!facing) return Array.from({ length: pages }, (_, index) => [index]);
  const rows: number[][] = pages > 0 ? [[0]] : [];
  for (let index = 1; index < pages; index += 2) {
    rows.push(index + 1 < pages ? [index, index + 1] : [index]);
  }
  return rows;
}

export interface PageViewProps {
  format: WorkFormat;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The work set as a book, to read it over: its pages at the size of the book, scaled to fit the
 * window, one by one or two facing. Nothing can be written here. It opens on the page of the
 * cursor; closing it leaves the continuous paper where it was.
 */
export function PageView({ format, onClose, onProblem }: PageViewProps) {
  const view = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<ComposedBook | null>(null);
  const [opening, setOpening] = useState(0);
  const [facing, setFacing] = useState(false);
  const [width, setWidth] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, height: 0 });

  // Compose the book: the text as saved, the blocks, their measures, the pages.
  useEffect(() => {
    let current = true;
    const cursor = currentCursor();
    void savePendingNow()
      .then(() => request("project.manuscript"))
      .then((manuscript) => {
        if (!current || !view.current) return;
        const chapters = manuscript.chapters.map((chapter) => chapterBlocks(chapter, document));
        const { blocks, options } = measureBook(chapters, format, view.current);
        const pages = layout(blocks, options);
        setBook({ chapters, measured: blocks, options, pages, geometry: geometryOf(format) });
        setOpening(pageOfCursor(pages, chapters, blocks, cursor));
        onProblem(null);
      })
      .catch((error: unknown) => current && onProblem(messageFor(error)));
    return () => {
      current = false;
    };
  }, [format, onProblem]);

  useEffect(() => {
    view.current?.focus();
    const area = scroller.current;
    if (!area) return;
    const observer = new ResizeObserver(() => {
      setWidth(area.clientWidth);
      setScroll({ top: area.scrollTop, height: area.clientHeight });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const notes = useMemo(
    () =>
      book?.measured.map((blocks) =>
        blocks.flatMap((block) => block.footnotes.map((note) => note.lines)),
      ) ?? [],
    [book],
  );

  const rows = useMemo(() => rowsOf(book?.pages.length ?? 0, facing), [book, facing]);
  const geometry = book?.geometry;
  const spread = geometry ? (facing ? 2 * geometry.width : geometry.width) : 1;
  const scale = geometry && width > 0 ? Math.min(1, (width - 2 * GAP) / spread) : 1;
  const rowHeight = geometry ? geometry.height * scale + GAP : 0;

  // Open on the page of the cursor, and keep it in sight when switching between one and two pages.
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!book || !scroller.current || rowHeight === 0) return;
    const page = shown.current ?? opening;
    const row = rows.findIndex((each) => each.includes(page));
    scroller.current.scrollTop = Math.max(0, row) * rowHeight;
    setScroll({ top: scroller.current.scrollTop, height: scroller.current.clientHeight });
  }, [book, opening, rows, rowHeight]);

  const first = rowHeight ? Math.max(0, Math.floor(scroll.top / rowHeight) - SPARE_ROWS) : 0;
  const last = rowHeight
    ? Math.min(rows.length - 1, Math.ceil((scroll.top + scroll.height) / rowHeight) + SPARE_ROWS)
    : -1;
  const inSight =
    rows[Math.min(rows.length - 1, Math.floor((scroll.top + rowHeight / 3) / (rowHeight || 1)))];

  return (
    <section
      ref={view}
      className="page-view"
      aria-label="Vista de página"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="page-view-bar small-caps">
        <h2 className="page-view-title">Vista de página</h2>
        <span className="page-view-count" aria-live="polite">
          {book
            ? `${book.pages.length} ${book.pages.length === 1 ? "página" : "páginas"}`
            : "Componiendo las páginas…"}
        </span>
        <span className="page-view-actions">
          <button
            type="button"
            className="action"
            aria-pressed={facing}
            onClick={() => {
              shown.current = inSight?.[0] ?? opening;
              setFacing((two) => !two);
            }}
          >
            Dos páginas
          </button>
          <button type="button" className="action" title="Cerrar (F5)" onClick={onClose}>
            Cerrar
          </button>
        </span>
      </header>

      <div
        ref={scroller}
        className="page-view-scroller"
        onScroll={(event) =>
          setScroll({
            top: event.currentTarget.scrollTop,
            height: event.currentTarget.clientHeight,
          })
        }
      >
        {book && geometry && (
          <div className="page-view-book" style={{ height: rows.length * rowHeight + GAP }}>
            {rows.slice(first, last + 1).map((row, offset) => {
              const index = first + offset;
              return (
                <div
                  key={row.join("-")}
                  className={`page-view-row${facing ? " page-view-row-facing" : ""}`}
                  style={{ top: GAP + index * rowHeight, height: geometry.height * scale }}
                >
                  {/* The first page is a right-hand page: alone, on the right of the spine. */}
                  {facing && row.length === 1 && row[0] === 0 && (
                    <div style={{ width: geometry.width * scale }} aria-hidden="true" />
                  )}
                  {row.map((page) => (
                    <div
                      key={page}
                      className="page-view-frame"
                      style={{ width: geometry.width * scale, height: geometry.height * scale }}
                    >
                      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
                        <PageSheet
                          page={book.pages[page]!}
                          book={book}
                          format={format}
                          notes={notes}
                        />
                      </div>
                    </div>
                  ))}
                  {/* A last even page alone stays on the left of the spine. */}
                  {facing && row.length === 1 && row[0] !== 0 && (
                    <div style={{ width: geometry.width * scale }} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

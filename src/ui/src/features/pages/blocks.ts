import { getSchema, type JSONContent } from "@tiptap/core";
import { DOMSerializer, type Schema } from "@tiptap/pm/model";
import type { ManuscriptChapter, TipTapNode } from "../../bridge/generated/protocol";
import { bookExtensions } from "../../editor/extensions";

/** A chapter of the book, ready to be measured and drawn: its title, then its blocks. */
export interface BookChapter {
  id: string;
  title: string;
  /** The title of the chapter first, then one element per top-level node of its text. */
  blocks: HTMLElement[];
  /** The text of each footnote of the chapter, in reading order: footnote n is texts[n - 1]. */
  footnotes: string[];
  /**
   * Where each block is in the text of the chapter, as ProseMirror positions, to find the page of
   * the cursor. The title is not in the text: its range is null.
   */
  ranges: ({ from: number; to: number } | null)[];
}

let schema: Schema | null = null;

/** The schema of the editor, built once: the page view sets the text with the same rules. */
function bookSchema(): Schema {
  schema ??= getSchema(bookExtensions());
  return schema;
}

/**
 * The text of the work without what belongs to the writer alone: the anchors of their notes. A
 * passage keeps its words and loses the mark; a point note disappears.
 */
export function withoutNotes(node: TipTapNode): TipTapNode | null {
  if (node.type === "notePoint") return null;
  const marks = node.marks?.filter((mark) => mark.type !== "noteAnchor");
  const content = node.content
    ?.map(withoutNotes)
    .filter((child): child is TipTapNode => child !== null);
  return {
    ...node,
    ...(node.marks ? { marks } : {}),
    ...(node.content ? { content } : {}),
  };
}

/** Sets a chapter as elements: the page view measures them and draws copies of them. */
export function chapterBlocks(chapter: ManuscriptChapter, document: Document): BookChapter {
  const schemaOfBook = bookSchema();
  const serializer = DOMSerializer.fromSchema(schemaOfBook);
  const text = withoutNotes(chapter.content as TipTapNode) ?? { type: "doc" };
  // Through the schema, so the nodes are of the same ProseMirror as the schema itself.
  const root = schemaOfBook.nodeFromJSON(text as JSONContent);

  const title = document.createElement("h1");
  title.className = "page-chapter-title";
  title.textContent = chapter.title;

  const footnotes: string[] = [];
  const blocks: HTMLElement[] = [title];
  const ranges: BookChapter["ranges"] = [null];
  let previous: string | null = null;
  let opened = false;
  root.forEach((node, offset) => {
    ranges.push({ from: offset, to: offset + node.nodeSize });
    const element = serializer.serializeNode(node, { document }) as HTMLElement;
    // Each block is drawn on its own, so what the editor gets from its neighbours is said here:
    // a paragraph after another is indented (or spaced), and the first one opens the chapter.
    if (node.type.name === "paragraph") {
      if (previous === "paragraph") element.classList.add("page-follows");
      if (!opened) element.classList.add("page-opening");
      opened = true;
    }
    previous = node.type.name;
    // Footnotes are numbered here, in reading order: a page shows only part of the chapter, so
    // the counter of the editor would start again on every page.
    for (const call of element.querySelectorAll<HTMLElement>("sup.footnote")) {
      footnotes.push(call.dataset.text ?? "");
      call.dataset.number = String(footnotes.length);
      call.removeAttribute("title");
    }
    blocks.push(element);
  });
  return { id: chapter.id, title: chapter.title, blocks, footnotes, ranges };
}

import { Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnote: {
      /** Puts a footnote at the cursor, with the given text. */
      insertFootnote: (text?: string) => ReturnType;
      /** Changes the text of the footnote at a document position. */
      setFootnoteText: (position: number, text: string) => ReturnType;
    };
  }
}

/** A footnote of a document: where it is and what it says. Numbered from 1 in reading order. */
export interface FootnoteEntry {
  number: number;
  position: number;
  text: string;
}

/**
 * A footnote: an inline mark in the text, numbered automatically, whose text lives in its
 * attributes. Unlike a note, it is part of the work: it is counted and will be exported.
 */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (element) => element.dataset.text ?? "",
        renderHTML: (attributes) => ({ "data-text": attributes.text }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote]" }];
  },

  renderHTML({ HTMLAttributes }) {
    // The number comes from a CSS counter, so it follows the order of the text by itself.
    return [
      "sup",
      {
        ...HTMLAttributes,
        "data-footnote": "",
        class: "footnote",
        title: HTMLAttributes["data-text"],
      },
    ];
  },

  addCommands() {
    return {
      insertFootnote:
        (text = "") =>
        ({ chain, state }) =>
          chain().insertContentAt(state.selection.to, { type: this.name, attrs: { text } }).run(),
      setFootnoteText:
        (position, text) =>
        ({ tr, state, dispatch }) => {
          const node = state.doc.nodeAt(position);
          if (node?.type.name !== this.name) return false;
          if (dispatch) dispatch(tr.setNodeMarkup(position, undefined, { ...node.attrs, text }));
          return true;
        },
    };
  },
});

/** Every footnote of a document, numbered in reading order. */
export function footnotesOf(doc: ProseMirrorNode): FootnoteEntry[] {
  const entries: FootnoteEntry[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "footnote") {
      entries.push({ number: entries.length + 1, position, text: String(node.attrs.text ?? "") });
    }
  });
  return entries;
}

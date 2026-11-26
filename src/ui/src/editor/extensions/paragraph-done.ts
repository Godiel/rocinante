import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { blockText } from "./block-text";

/** How long the writer stays without typing in a paragraph before it counts as finished. */
export const PARAGRAPH_PAUSE_MS = 8000;

export interface ParagraphDoneOptions {
  /** Told the text of a paragraph the writer finished: with Intro, or after a pause in it. */
  onDone: (text: string) => void;
  pauseMs: number;
}

/** A paragraph worth reading: a few words, not a blank line nor a lone mark. */
export function worthReading(text: string): boolean {
  return (text.trim().match(/\p{L}+/gu) ?? []).length >= 2;
}

/** The text of the block the cursor is in, if it is a text block. */
function blockAtCursor(state: EditorState): string | null {
  const { $from } = state.selection;
  const block = $from.parent;
  if (!block.isTextblock) return null;
  return blockText(block, $from.before()).text;
}

const KEY = new PluginKey("paragraphDone");

/**
 * Tells when the writer finishes a paragraph, for the squire: on Intro, the paragraph being left; after a
 * pause with no typing, the paragraph the cursor is in. Nothing in the text changes.
 */
export const ParagraphDone = Extension.create<ParagraphDoneOptions>({
  name: "paragraphDone",
  // Before the keys of the editor, which take Intro to split the paragraph.
  priority: 1000,

  addOptions() {
    return { onDone: () => {}, pauseMs: PARAGRAPH_PAUSE_MS };
  },

  addProseMirrorPlugins() {
    const { onDone, pauseMs } = this.options;
    const tell = (text: string | null) => {
      if (text !== null && worthReading(text)) onDone(text.trim());
    };
    return [
      new Plugin({
        key: KEY,
        props: {
          handleKeyDown: (view, event) => {
            const plain = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
            if (event.key === "Enter" && plain && !event.isComposing) {
              tell(blockAtCursor(view.state));
            }
            return false;
          },
        },
        view: () => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          return {
            update: (view, previous) => {
              if (view.state.doc.eq(previous.doc)) return;
              clearTimeout(timer);
              timer = setTimeout(() => tell(blockAtCursor(view.state)), pauseMs);
            },
            destroy: () => clearTimeout(timer),
          };
        },
      }),
    ];
  },
});

/** Where a paragraph the squire read is now: the one with that text, or failing that, one that begins like it. */
export function passageRange(
  doc: ProseMirrorNode,
  passage: string,
): { from: number; to: number } | null {
  const wanted = passage.trim();
  // Half of it, at most 40 letters: enough to know it, little enough to survive a change at its end.
  const opening =
    wanted.length >= 10 ? wanted.slice(0, Math.min(40, Math.ceil(wanted.length / 2))) : "";
  let exact: { from: number; to: number } | null = null;
  let alike: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (exact) return false;
    if (!node.isTextblock) return true;
    const text = blockText(node, pos).text.trim();
    const range = { from: pos + 1, to: pos + node.nodeSize - 1 };
    if (text === wanted) exact = range;
    else if (!alike && opening.length > 0 && text.startsWith(opening)) alike = range;
    return false;
  });
  return exact ?? alike;
}

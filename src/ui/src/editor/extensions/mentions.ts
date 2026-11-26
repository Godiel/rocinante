import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findMentions, type MentionIndex } from "../../features/mentions/find-mentions";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mentions: {
      /** The names of the fichas to look for; null looks for none. */
      setMentionIndex: (index: MentionIndex | null) => ReturnType;
      /** Shows or hides the marks, without looking for anything again. */
      setMentionsVisible: (visible: boolean) => ReturnType;
    };
  }
}

interface MentionsState {
  index: MentionIndex | null;
  visible: boolean;
  decorations: DecorationSet;
}

type Meta = { index: MentionIndex | null } | { visible: boolean };

const key = new PluginKey<MentionsState>("mentions");

/** A text block's words as the core reads them, and where each of its characters is in the document. */
function blockText(block: ProseMirrorNode, start: number): { text: string; positions: number[] } {
  let text = "";
  const positions: number[] = [];
  block.forEach((child, offset) => {
    const at = start + 1 + offset;
    if (child.isText) {
      const value = child.text ?? "";
      for (let index = 0; index < value.length; index++) positions.push(at + index);
      text += value;
    } else if (child.type.name === "hardBreak") {
      positions.push(at);
      text += "\n";
    }
    // Footnotes and note anchors are not words of the text: the core leaves them out too.
  });
  return { text, positions };
}

/** The mentions of one text block, as document ranges. */
function mentionsInBlock(
  block: ProseMirrorNode,
  start: number,
  index: MentionIndex,
): { from: number; to: number; elements: readonly string[] }[] {
  const { text, positions } = blockText(block, start);
  return findMentions(text, index).map((mention) => ({
    from: positions[mention.start]!,
    to: positions[mention.start + mention.length - 1]! + 1,
    elements: mention.elements,
  }));
}

function decorationsOf(block: ProseMirrorNode, start: number, index: MentionIndex): Decoration[] {
  return mentionsInBlock(block, start, index).map((mention) =>
    Decoration.inline(mention.from, mention.to, {
      class: "mention",
      "data-elements": mention.elements.join(" "),
    }),
  );
}

function decorateAll(doc: ProseMirrorNode, index: MentionIndex | null): DecorationSet {
  if (!index) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.isTextblock) return true;
    decorations.push(...decorationsOf(node, position, index));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** Only the blocks a change touched are looked through again; the other marks move along. */
function redecorate(tr: Transaction, previous: DecorationSet, index: MentionIndex): DecorationSet {
  let decorations = previous.map(tr.mapping, tr.doc);
  const touched: [number, number][] = [];
  tr.mapping.maps.forEach((map, step) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const rest = tr.mapping.slice(step + 1);
      touched.push([rest.map(newStart, -1), rest.map(newEnd, 1)]);
    });
  });
  const seen = new Set<number>();
  for (const [from, to] of touched) {
    const start = Math.max(0, Math.min(from, tr.doc.content.size));
    const end = Math.max(start, Math.min(to, tr.doc.content.size));
    tr.doc.nodesBetween(start, end, (node, position) => {
      if (!node.isTextblock) return true;
      if (seen.has(position)) return false;
      seen.add(position);
      const blockEnd = position + node.nodeSize;
      decorations = decorations
        .remove(decorations.find(position, blockEnd))
        .add(tr.doc, decorationsOf(node, position, index));
      return false;
    });
  }
  return decorations;
}

/**
 * Marks the names and aliases of the fichas in the text. Typing looks through the blocks it touched only;
 * the whole text is looked through again when the names change.
 */
export const Mentions = Extension.create({
  name: "mentions",

  addCommands() {
    return {
      setMentionIndex:
        (index) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, { index } satisfies Meta).setMeta("addToHistory", false);
          return true;
        },
      setMentionsVisible:
        (visible) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, { visible } satisfies Meta).setMeta("addToHistory", false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<MentionsState>({
        key,
        state: {
          init: () => ({ index: null, visible: true, decorations: DecorationSet.empty }),
          apply: (tr, state) => {
            const meta = tr.getMeta(key) as Meta | undefined;
            if (meta && "index" in meta) {
              return { ...state, index: meta.index, decorations: decorateAll(tr.doc, meta.index) };
            }
            const visible = meta && "visible" in meta ? meta.visible : state.visible;
            if (!tr.docChanged || !state.index)
              return visible === state.visible ? state : { ...state, visible };
            return {
              ...state,
              visible,
              decorations: redecorate(tr, state.decorations, state.index),
            };
          },
        },
        props: {
          decorations: (state) => {
            const current = key.getState(state);
            return current?.visible ? current.decorations : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/**
 * The place of the mention with this number among those of a ficha in the document: the core counts them the
 * same way, so «En el texto» can take the writer to one.
 */
export function mentionAt(
  doc: ProseMirrorNode,
  index: MentionIndex,
  elementId: string,
  ordinal: number,
): { from: number; to: number } | null {
  let seen = 0;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, position) => {
    if (found) return false;
    if (!node.isTextblock) return true;
    for (const mention of mentionsInBlock(node, position, index)) {
      if (!mention.elements.includes(elementId)) continue;
      if (seen === ordinal) {
        found = { from: mention.from, to: mention.to };
        break;
      }
      seen++;
    }
    return false;
  });
  return found;
}

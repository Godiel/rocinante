import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { punctuationIssues } from "../../features/correction/punctuation";
import { leftOut, wordsOf, type SpellChecker } from "../../features/correction/spelling";
import { blockText, rangeOf } from "./block-text";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    correction: {
      /** The speller and the words the writer accepts; a null speller checks only the punctuation. */
      setCorrection: (setup: CorrectionSetup) => ReturnType;
      /** Shows or hides the marks, without checking anything again. */
      setCorrectionVisible: (visible: boolean) => ReturnType;
      /** Marks the text again: the speller has new answers. */
      refreshCorrection: () => ReturnType;
    };
  }
}

export interface CorrectionSetup {
  checker: SpellChecker | null;
  accepted: ReadonlySet<string>;
}

interface CorrectionState extends CorrectionSetup {
  visible: boolean;
  decorations: DecorationSet;
  /** Where the cursor was: the word being typed there is not marked until the writer leaves it. */
  cursor: number;
}

type Meta = { setup: CorrectionSetup } | { visible: boolean } | { refresh: true };

const key = new PluginKey<CorrectionState>("correction");

/** The marks of one text block: the words the speller says are wrong, and the punctuation problems. */
function decorationsOf(
  block: ProseMirrorNode,
  start: number,
  setup: CorrectionSetup,
  cursor: number,
): Decoration[] {
  const { text, positions } = blockText(block, start);
  const marks: Decoration[] = [];
  if (setup.checker) {
    for (const { start: at, word } of wordsOf(text)) {
      if (leftOut(word, setup.accepted) || setup.checker.isCorrect(word) !== false) continue;
      const { from, to } = rangeOf(positions, at, word.length);
      if (from <= cursor && cursor <= to) continue;
      marks.push(Decoration.inline(from, to, { class: "misspelled", "data-word": word }));
    }
  }
  for (const issue of punctuationIssues(text)) {
    const { from, to } = rangeOf(positions, issue.start, issue.length);
    marks.push(
      Decoration.inline(from, to, {
        class: "punctuation-issue",
        "data-message": issue.message,
        ...(issue.fix !== undefined && { "data-fix": issue.fix }),
      }),
    );
  }
  return marks;
}

function decorateAll(doc: ProseMirrorNode, setup: CorrectionSetup, cursor: number): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (!node.isTextblock) return true;
    decorations.push(...decorationsOf(node, position, setup, cursor));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** The text block around a position, if there is one. */
function blockAt(
  doc: ProseMirrorNode,
  position: number,
): { node: ProseMirrorNode; start: number } | null {
  if (position < 0 || position > doc.content.size) return null;
  const resolved = doc.resolve(position);
  for (let depth = resolved.depth; depth >= 0; depth--) {
    const node = resolved.node(depth);
    if (node.isTextblock) return { node, start: resolved.before(depth) };
  }
  return null;
}

/**
 * Only the blocks a change touched are checked again, and the one the cursor left; the other marks move
 * along.
 */
function redecorate(
  tr: Transaction,
  previous: DecorationSet,
  setup: CorrectionSetup,
  cursorBefore: number,
): DecorationSet {
  const cursor = tr.selection.head;
  let decorations = tr.docChanged ? previous.map(tr.mapping, tr.doc) : previous;
  const seen = new Set<number>();
  const again = (node: ProseMirrorNode, position: number) => {
    if (seen.has(position)) return;
    seen.add(position);
    decorations = decorations
      .remove(decorations.find(position, position + node.nodeSize))
      .add(tr.doc, decorationsOf(node, position, setup, cursor));
  };
  for (const position of [tr.mapping.map(cursorBefore), cursor]) {
    const block = blockAt(tr.doc, position);
    if (block) again(block.node, block.start);
  }
  tr.mapping.maps.forEach((map, step) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const rest = tr.mapping.slice(step + 1);
      const from = Math.max(0, Math.min(rest.map(newStart, -1), tr.doc.content.size));
      const to = Math.max(from, Math.min(rest.map(newEnd, 1), tr.doc.content.size));
      tr.doc.nodesBetween(from, to, (node, position) => {
        if (!node.isTextblock) return true;
        again(node, position);
        return false;
      });
    });
  });
  return decorations;
}

/**
 * Marks what looks wrong in the spelling and the punctuation. It only marks: the text changes only when the
 * writer takes a suggestion. Typing checks the blocks it touched; the speller's answers mark it all again.
 */
export const Correction = Extension.create({
  name: "correction",

  addCommands() {
    return {
      setCorrection:
        (setup) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, { setup } satisfies Meta).setMeta("addToHistory", false);
          return true;
        },
      setCorrectionVisible:
        (visible) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, { visible } satisfies Meta).setMeta("addToHistory", false);
          return true;
        },
      refreshCorrection:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch)
            tr.setMeta(key, { refresh: true } satisfies Meta).setMeta("addToHistory", false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<CorrectionState>({
        key,
        state: {
          init: () => ({
            checker: null,
            accepted: new Set(),
            visible: false,
            decorations: DecorationSet.empty,
            cursor: 0,
          }),
          apply: (tr, state) => {
            const meta = tr.getMeta(key) as Meta | undefined;
            const cursor = tr.selection.head;
            if (meta && "setup" in meta) {
              const decorations = decorateAll(tr.doc, meta.setup, cursor);
              return { ...state, ...meta.setup, decorations, cursor };
            }
            if (meta && "refresh" in meta) {
              return { ...state, decorations: decorateAll(tr.doc, state, cursor), cursor };
            }
            const visible = meta && "visible" in meta ? meta.visible : state.visible;
            if (!tr.docChanged && !tr.selectionSet) {
              return visible === state.visible ? state : { ...state, visible };
            }
            const decorations = redecorate(tr, state.decorations, state, state.cursor);
            return { ...state, visible, decorations, cursor };
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

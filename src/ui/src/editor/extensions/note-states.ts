import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteStates: {
      /**
       * Says which notes are resolved and which are shown. The anchors of resolved notes fade; those of
       * notes no longer shown (set aside, waiting for an undo) are hidden. Null `shown` hides nothing.
       */
      setNoteStates: (states: NoteStates) => ReturnType;
    };
  }
}

export interface NoteStates {
  resolved: readonly string[];
  shown: readonly string[] | null;
}

const key = new PluginKey<DecorationSet>("noteStates");

function decorate(doc: ProseMirrorNode, states: NoteStates): DecorationSet {
  const resolved = new Set(states.resolved);
  const shown = states.shown && new Set(states.shown);
  const classOf = (id: unknown) =>
    typeof id !== "string"
      ? null
      : shown && !shown.has(id)
        ? "note-anchor-gone"
        : resolved.has(id)
          ? "note-anchor-resolved"
          : null;

  const decorations: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === "notePoint") {
      const name = classOf(node.attrs.noteId);
      if (name)
        decorations.push(Decoration.node(position, position + node.nodeSize, { class: name }));
      return false;
    }
    if (!node.isText) return true;
    for (const mark of node.marks) {
      if (mark.type.name !== "noteAnchor") continue;
      const name = classOf(mark.attrs.noteId);
      if (name)
        decorations.push(Decoration.inline(position, position + node.nodeSize, { class: name }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * How each note's anchor looks, from what the notes are. Typing only moves the decorations along; they are
 * worked out again only when the notes change.
 */
export const NoteStatesExtension = Extension.create({
  name: "noteStates",

  addCommands() {
    return {
      setNoteStates:
        (states) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, states).setMeta("addToHistory", false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, decorations) => {
            const states = tr.getMeta(key) as NoteStates | undefined;
            if (states) return decorate(tr.doc, states);
            return tr.docChanged ? decorations.map(tr.mapping, tr.doc) : decorations;
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});

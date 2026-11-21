import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** The class of the block the writer is in. */
export const CURRENT_BLOCK = "is-current";

/**
 * Marks the paragraph (or title, or quote) where the cursor is, so focus mode can dim the rest.
 * It only adds a class: the text is never touched, and outside focus mode nothing shows it.
 */
export const CurrentBlock = Extension.create({
  name: "currentBlock",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("currentBlock"),
        props: {
          decorations(state) {
            const { $head } = state.selection;
            if ($head.depth < 1) return DecorationSet.empty;
            const from = $head.before(1);
            const node = state.doc.nodeAt(from);
            if (!node) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(from, from + node.nodeSize, { class: CURRENT_BLOCK }),
            ]);
          },
        },
      }),
    ];
  },
});

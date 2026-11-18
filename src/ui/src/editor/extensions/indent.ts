import { Extension } from "@tiptap/core";

export const MAX_INDENT = 4;
const INDENTABLE = ["paragraph", "heading"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Moves the selected paragraphs one step to the right. */
      indent: () => ReturnType;
      /** Moves the selected paragraphs one step back to the left. */
      outdent: () => ReturnType;
    };
  }
}

/**
 * Block indentation in steps, for verse, letters or quoted passages set apart. Tab and Shift-Tab
 * work outside lists; inside a list they keep nesting list items.
 */
export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => clamp(Number(element.dataset.indent ?? 0)),
            renderHTML: (attributes) =>
              attributes.indent > 0 ? { "data-indent": String(attributes.indent) } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const shift =
      (step: number) =>
      () =>
      ({ tr, state, dispatch }: import("@tiptap/core").CommandProps) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, position) => {
          if (!INDENTABLE.includes(node.type.name)) return;
          const indent = clamp(Number(node.attrs.indent ?? 0) + step);
          if (indent !== node.attrs.indent) {
            tr.setNodeMarkup(position, undefined, { ...node.attrs, indent });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return { indent: shift(1), outdent: shift(-1) };
  },

  addKeyboardShortcuts() {
    const outsideLists = (command: () => boolean) => () =>
      this.editor.isActive("listItem") ? false : command();
    return {
      Tab: outsideLists(() => this.editor.commands.indent()),
      "Shift-Tab": outsideLists(() => this.editor.commands.outdent()),
    };
  },
});

function clamp(indent: number): number {
  return Number.isFinite(indent) ? Math.min(MAX_INDENT, Math.max(0, Math.trunc(indent))) : 0;
}

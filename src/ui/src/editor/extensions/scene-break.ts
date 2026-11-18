import { Node, nodeInputRule } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBreak: {
      /** Ends a scene with a fleuron, as printed books do. */
      insertSceneBreak: () => ReturnType;
    };
  }
}

// The same hedera as the welcome screen, as markup for a plain DOM node view.
const FLEURON = `<svg width="28" height="22" viewBox="0 0 30 24" fill="none" aria-hidden="true" focusable="false">
<path d="M6 12c3.2-6.4 9.6-9 17-7.6-1.4 1.6-2.2 3.6-2.2 7.6s.8 6 2.2 7.6C15.6 21 9.2 18.4 6 12Z" fill="currentColor"/>
<path d="M8.6 12h11.4" stroke="var(--color-paper)" stroke-width="0.9" stroke-linecap="round"/>
<path d="M6 12C4.6 12 3 11.2 2.4 9.6c-.5-1.3.2-2.6 1.4-2.6 1 0 1.6.8 1.3 1.6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
</svg>`;

/**
 * A scene break: a block with no text, shown as a fleuron. Typing «***» and a space at the start
 * of an empty line makes one, as does Ctrl+Shift+Enter.
 */
export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: "hr[data-scene-break]" }];
  },

  renderHTML() {
    return ["hr", { "data-scene-break": "" }];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement("div");
      dom.className = "scene-break";
      dom.setAttribute("role", "separator");
      dom.setAttribute("aria-label", "Cambio de escena");
      dom.contentEditable = "false";
      dom.innerHTML = FLEURON;
      return { dom };
    };
  },

  addCommands() {
    return {
      insertSceneBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent([{ type: this.name }, { type: "paragraph" }])
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return { "Mod-Shift-Enter": () => this.editor.commands.insertSceneBreak() };
  },

  addInputRules() {
    return [nodeInputRule({ find: /^\*\*\*\s$/, type: this.type })];
  },
});

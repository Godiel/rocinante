import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Stroke } from "../../audio/typing-sounds";

export interface TypingSoundsOptions {
  /** Makes the sound of a stroke; the engine decides whether it is heard. */
  play(stroke: Stroke): void;
}

/** How close to the right edge of the line the bell rings, as a share of the line. */
export const BELL_ZONE = 0.1;

/**
 * Sounds the typing from what the text does, not from the keyboard: a character written, a new
 * paragraph, something erased. Shortcuts, arrows and the dead keys of accents make no sound. The
 * typewriter's bell rings once per line, as the carriage nears the margin.
 */
export const TypingSounds = Extension.create<TypingSoundsOptions>({
  name: "typingSounds",

  addOptions() {
    return { play: () => {} };
  },

  addProseMirrorPlugins() {
    const { play } = this.options;
    // The line the bell last rang on, by its top edge on the screen.
    let rangOn: number | null = null;

    return [
      new Plugin({
        key: new PluginKey("typingSounds"),
        props: {
          handleTextInput(view, from) {
            play("key");
            const line = nearLineEnd(view, from);
            if (line !== null && line !== rangOn) {
              rangOn = line;
              play("bell");
            }
            return false;
          },
          handleKeyDown(view, event) {
            if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
            if (event.key === "Enter") {
              rangOn = null;
              play("enter");
            } else if (event.key === "Backspace" || event.key === "Delete") {
              const { empty, from } = view.state.selection;
              // Nothing to erase at the very start or end of the text.
              const atEdge =
                empty &&
                (event.key === "Backspace" ? from <= 1 : from >= view.state.doc.content.size - 1);
              if (!atEdge) play("backspace");
            }
            return false;
          },
        },
      }),
    ];
  },
});

/** The top of the line `position` is on, if it is near the right edge of the text; else null. */
function nearLineEnd(view: EditorView, position: number): number | null {
  try {
    const caret = view.coordsAtPos(position);
    const text = view.dom.getBoundingClientRect();
    if (text.width <= 0) return null;
    return text.right - caret.left <= text.width * BELL_ZONE ? Math.round(caret.top) : null;
  } catch {
    // A position the view cannot place (a node being redrawn): no bell this time.
    return null;
  }
}

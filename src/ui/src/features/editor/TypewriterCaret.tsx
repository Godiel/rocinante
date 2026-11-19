import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { caretBox, type CaretBox } from "../../editor/typewriter";

interface TypewriterCaretProps {
  editor: Editor;
  /** The positioned frame the caret is drawn in. */
  frame: RefObject<HTMLElement | null>;
}

/**
 * The typewriter's caret: a thick bar that blinks softly and stays solid while typing. Browsers
 * cannot reshape the text caret, so this one is drawn over the text and the real one is made
 * transparent. It steps aside, giving back the system caret, when text is selected, when the
 * editor loses focus and while an input method composes a character.
 */
export function TypewriterCaret({ editor, frame }: TypewriterCaretProps) {
  const [box, setBox] = useState<CaretBox | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;
    let composing = false;

    const update = () => {
      const container = frame.current;
      const { selection } = editor.state;
      const show = container && editor.isFocused && selection.empty && !composing;
      dom.classList.toggle("has-typewriter-caret", Boolean(show));
      if (!show) {
        setBox(null);
        return;
      }
      const coords = editor.view.coordsAtPos(selection.head);
      setBox(caretBox(coords, container.getBoundingClientRect()));
    };
    const startComposing = () => {
      composing = true;
      update();
    };
    const endComposing = () => {
      composing = false;
      update();
    };

    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    dom.addEventListener("compositionstart", startComposing);
    dom.addEventListener("compositionend", endComposing);
    window.addEventListener("resize", update);
    update();

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
      dom.removeEventListener("compositionstart", startComposing);
      dom.removeEventListener("compositionend", endComposing);
      window.removeEventListener("resize", update);
      dom.classList.remove("has-typewriter-caret");
    };
  }, [editor, frame]);

  if (!box) return null;
  // The key restarts the blink on every move: the caret stays solid while the writer types.
  return (
    <span
      key={`${box.top}:${box.left}`}
      className="typewriter-caret"
      aria-hidden="true"
      style={{ top: box.top, left: box.left, height: box.height }}
    />
  );
}

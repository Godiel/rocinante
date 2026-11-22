// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookExtensions } from ".";
import { BELL_ZONE, TypingSounds } from "./typing-sounds";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function write(text = "En un lugar") {
  const play = vi.fn();
  editor = new Editor({
    extensions: [...bookExtensions(), TypingSounds.configure({ play })],
    content: `<p>${text}</p>`,
  });
  return { play, view: editor.view };
}

const type = (view: Editor["view"], text: string) => {
  const { from, to } = view.state.selection;
  view.someProp("handleTextInput", (handle) => handle(view, from, to, text, () => view.state.tr));
};

const press = (view: Editor["view"], init: KeyboardEventInit) =>
  view.someProp("handleKeyDown", (handle) => handle(view, new KeyboardEvent("keydown", init)));

describe("the typing sounds", () => {
  it("sound each character written, without taking it from the editor", () => {
    const { play, view } = write();
    editor!.commands.setTextSelection(5);

    type(view, "a");
    type(view, "b");

    expect(play.mock.calls).toEqual([["key"], ["key"]]);
    expect(
      view.someProp("handleTextInput", (handle) => handle(view, 1, 1, "c", () => view.state.tr)),
    ).toBeFalsy();
  });

  it("sound a character key as it goes down, once, before the editor takes the text in", () => {
    const { play, view } = write();
    editor!.commands.setTextSelection(5);

    press(view, { key: "a" });
    expect(play.mock.calls).toEqual([["key"]]);
    type(view, "a");
    press(view, { key: " " });
    type(view, " ");

    expect(play.mock.calls).toEqual([["key"], ["key"]]);
  });

  it("sound a character composed after a dead key once, when it arrives", () => {
    const { play, view } = write();
    editor!.commands.setTextSelection(5);

    press(view, { key: "Dead" });
    type(view, "á");

    expect(play.mock.calls).toEqual([["key"]]);
  });

  it("sound Enter and erasing, but not shortcuts, arrows or the dead keys of accents", () => {
    const { play, view } = write();
    editor!.commands.setTextSelection(5);

    press(view, { key: "Enter" });
    press(view, { key: "Backspace" });
    press(view, { key: "Delete" });
    press(view, { key: "b", ctrlKey: true });
    press(view, { key: "Enter", ctrlKey: true });
    press(view, { key: "ArrowLeft" });
    press(view, { key: "Dead", isComposing: true });
    press(view, { key: "Backspace", isComposing: true });

    expect(play.mock.calls).toEqual([["enter"], ["backspace"], ["backspace"]]);
  });

  it("make no sound erasing at the very start or end of the text, where nothing goes", () => {
    const { play, view } = write("Uno");

    editor!.commands.setTextSelection(1);
    press(view, { key: "Backspace" });
    editor!.commands.setTextSelection(4);
    press(view, { key: "Delete" });

    expect(play).not.toHaveBeenCalled();
  });

  it("ring the bell once a line, near its right edge, and again on the next line", () => {
    const { play, view } = write();
    vi.spyOn(view.dom, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 600,
      width: 600,
      top: 0,
      bottom: 800,
      height: 800,
    } as DOMRect);
    const caret = (left: number, top: number) =>
      vi.spyOn(view, "coordsAtPos").mockReturnValue({ left, right: left, top, bottom: top + 20 });

    caret(300, 0);
    type(view, "a");
    caret(600 - 600 * BELL_ZONE + 1, 0);
    type(view, "b");
    caret(590, 0);
    type(view, "c");
    caret(590, 30);
    type(view, "d");

    expect(play.mock.calls.filter(([stroke]) => stroke === "bell")).toHaveLength(2);
  });
});

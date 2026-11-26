// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookExtensions } from ".";
import { ParagraphDone, passageRange, worthReading } from "./paragraph-done";

let current: Editor | undefined;

function edit(onDone: (text: string) => void): Editor {
  current = new Editor({
    extensions: [...bookExtensions(), ParagraphDone.configure({ onDone, pauseMs: 8000 })],
    content: "<p>Antonio llegó con su hijo Claudio.</p><p>Otro</p>",
  });
  return current;
}

function press(editor: Editor, key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  editor.view.someProp("handleKeyDown", (handle) => handle(editor.view, event));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  current?.destroy();
  current = undefined;
  vi.useRealTimers();
});

describe("a finished paragraph", () => {
  it("is told on Intro, the paragraph being left", () => {
    const onDone = vi.fn();
    const editor = edit(onDone);
    editor.commands.setTextSelection(10);

    press(editor, "Enter", { shiftKey: true });
    expect(onDone).not.toHaveBeenCalled();
    press(editor, "Enter");
    // Mayús+Intro breaks the line and the paragraph goes on; Intro finishes it.
    expect(onDone).toHaveBeenCalledWith(
      "Antonio l" + String.fromCharCode(10) + "legó con su hijo Claudio.",
    );
  });

  it("is told after a pause in it, and not while the writer types", () => {
    const onDone = vi.fn();
    const editor = edit(onDone);
    editor.commands.setTextSelection(5);

    editor.commands.insertContent("a");
    vi.advanceTimersByTime(5000);
    editor.commands.insertContent("b");
    vi.advanceTimersByTime(5000);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0]![0]).toContain("Claudio");
  });

  it("is not a blank line nor a lone word", () => {
    expect(worthReading("  ")).toBe(false);
    expect(worthReading("Capítulo")).toBe(false);
    expect(worthReading("* * *")).toBe(false);
    expect(worthReading("Llegó Claudio.")).toBe(true);
  });

  it("is found again for «Ir al pasaje», even a little changed", () => {
    const editor = edit(() => {});
    const exact = passageRange(editor.state.doc, "Antonio llegó con su hijo Claudio.")!;
    expect(editor.state.doc.textBetween(exact.from, exact.to)).toBe(
      "Antonio llegó con su hijo Claudio.",
    );
    editor.commands.insertContentAt(exact.to - 1, " el pelirrojo");
    const alike = passageRange(editor.state.doc, "Antonio llegó con su hijo Claudio.")!;
    expect(editor.state.doc.textBetween(alike.from, alike.to)).toContain("pelirrojo");
    expect(passageRange(editor.state.doc, "Nada de esto está")).toBeNull();
  });
});

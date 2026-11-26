// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { bookExtensions } from ".";
import { NoteStatesExtension } from "./note-states";

const OPEN = "0196a3b2-7c4d-7e8f-9a0b-00000000000a";
const RESOLVED = "0196a3b2-7c4d-7e8f-9a0b-00000000000b";
const GONE = "0196a3b2-7c4d-7e8f-9a0b-00000000000c";
let current: Editor | undefined;

const anchored = (text: string, noteId: string): JSONContent => ({
  type: "text",
  text,
  marks: [{ type: "noteAnchor", attrs: { noteId } }],
});

function edit(): Editor {
  current = new Editor({
    extensions: [...bookExtensions(), NoteStatesExtension],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            anchored("abierta", OPEN),
            { type: "text", text: " y " },
            anchored("resuelta", RESOLVED),
            { type: "notePoint", attrs: { noteId: GONE } },
          ],
        },
      ],
    },
  });
  return current;
}

const marked = (editor: Editor, name: string) =>
  [...editor.view.dom.querySelectorAll(`.${name}`)].map((element) => element.textContent);

afterEach(() => {
  current?.destroy();
  current = undefined;
});

describe("how the anchors of notes look", () => {
  it("fades the resolved notes and hides those no longer shown", () => {
    const editor = edit();

    editor.commands.setNoteStates({ resolved: [RESOLVED], shown: [OPEN, RESOLVED] });

    expect(marked(editor, "note-anchor-resolved")).toEqual(["resuelta"]);
    expect(editor.view.dom.querySelectorAll(".note-point.note-anchor-gone")).toHaveLength(1);
    expect(marked(editor, "note-anchor-gone")).toEqual([""]);
  });

  it("keeps the looks while typing, without counting the change in the history", () => {
    const editor = edit();
    editor.commands.setNoteStates({ resolved: [RESOLVED], shown: [OPEN, RESOLVED] });

    editor.chain().setTextSelection(1).insertContent("Muy ").run();

    expect(marked(editor, "note-anchor-resolved")).toEqual(["resuelta"]);
    editor.commands.undo();
    expect(editor.getText()).toBe("abierta y resuelta");
    expect(marked(editor, "note-anchor-resolved")).toEqual(["resuelta"]);
  });

  it("hides nothing until the notes of the work are known", () => {
    const editor = edit();

    editor.commands.setNoteStates({ resolved: [], shown: null });

    expect(marked(editor, "note-anchor-gone")).toEqual([]);
  });
});

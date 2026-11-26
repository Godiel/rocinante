// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { bookExtensions } from ".";
import { mentionIndex } from "../../features/mentions/find-mentions";
import { mentionAt, Mentions } from "./mentions";

let current: Editor | undefined;

const index = mentionIndex([
  { id: "quijote", name: "Alonso Quijano", aliases: ["Don Quijote"] },
  { id: "sancho", name: "Sancho", aliases: [] },
]);

function edit(content: JSONContent): Editor {
  current = new Editor({ extensions: [...bookExtensions(), Mentions], content });
  return current;
}

const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const text = (value: string): JSONContent => ({ type: "text", text: value });

const marked = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll(".mention")].map(
    (element) => `${element.textContent}:${element.getAttribute("data-elements")}`,
  );

afterEach(() => {
  current?.destroy();
  current = undefined;
});

describe("the marks of the mentions", () => {
  it("marks every name and alias of the fichas", () => {
    const editor = edit({
      type: "doc",
      content: [
        paragraph(text("Don Quijote y Sancho salieron.")),
        { type: "heading", attrs: { level: 2 }, content: [text("Alonso Quijano")] },
      ],
    });

    editor.commands.setMentionIndex(index);

    expect(marked(editor)).toEqual([
      "Don Quijote:quijote",
      "Sancho:sancho",
      "Alonso Quijano:quijote",
    ]);
  });

  it("follows the text as the writer types and deletes", () => {
    const editor = edit({ type: "doc", content: [paragraph(text("Llegó San"))] });
    editor.commands.setMentionIndex(index);
    expect(marked(editor)).toEqual([]);

    editor.chain().setTextSelection(10).insertContent("cho").run();
    expect(marked(editor)).toEqual(["Sancho:sancho"]);

    editor.chain().setTextSelection({ from: 7, to: 13 }).deleteSelection().run();
    expect(marked(editor)).toEqual([]);
  });

  it("keeps the marks of the other paragraphs where they were", () => {
    const editor = edit({
      type: "doc",
      content: [paragraph(text("Sancho comía.")), paragraph(text("Y bebía."))],
    });
    editor.commands.setMentionIndex(index);

    editor.chain().setTextSelection(1).insertContent("Entonces ").run();

    expect(marked(editor)).toEqual(["Sancho:sancho"]);
    expect(editor.view.dom.querySelector(".mention")?.textContent).toBe("Sancho");
  });

  it("reads a name across a footnote, as the core does, but not across a line break", () => {
    const editor = edit({
      type: "doc",
      content: [
        paragraph(text("Don "), { type: "footnote", attrs: { text: "nota" } }, text("Quijote")),
        paragraph(text("Don"), { type: "hardBreak" }, text("Quijote")),
      ],
    });

    editor.commands.setMentionIndex(index);

    expect(editor.view.dom.querySelectorAll(".mention")).not.toHaveLength(0);
    expect(mentionAt(editor.state.doc, index, "quijote", 0)).toEqual({ from: 1, to: 13 });
    expect(mentionAt(editor.state.doc, index, "quijote", 1)).toBeNull();
  });

  it("hides and shows the marks, and looks for nothing without names", () => {
    const editor = edit({ type: "doc", content: [paragraph(text("Sancho comía."))] });
    editor.commands.setMentionIndex(index);

    editor.commands.setMentionsVisible(false);
    expect(marked(editor)).toEqual([]);
    editor.commands.setMentionsVisible(true);
    expect(marked(editor)).toEqual(["Sancho:sancho"]);

    editor.commands.setMentionIndex(null);
    expect(marked(editor)).toEqual([]);
  });

  it("finds a mention of a ficha by its number, as «En el texto» counts them", () => {
    const editor = edit({
      type: "doc",
      content: [paragraph(text("Sancho y Sancho.")), paragraph(text("Otra vez Sancho."))],
    });

    expect(mentionAt(editor.state.doc, index, "sancho", 2)).toEqual({ from: 28, to: 34 });
    expect(mentionAt(editor.state.doc, index, "sancho", 3)).toBeNull();
    expect(mentionAt(editor.state.doc, index, "quijote", 0)).toBeNull();
  });

  it("does not count the change in the history", () => {
    const editor = edit({ type: "doc", content: [paragraph(text("Sancho"))] });
    editor.commands.setMentionIndex(index);

    expect(editor.can().undo()).toBe(false);
  });
});

// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { anchorsOf, bookExtensions, footnotesOf, MAX_INDENT } from ".";

const NOTE = "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b";
let current: Editor | undefined;

function edit(content: JSONContent | string): Editor {
  current = new Editor({ extensions: bookExtensions(), content });
  return current;
}

const paragraph = (text: string, attrs?: Record<string, unknown>): JSONContent => ({
  type: "paragraph",
  ...(attrs && { attrs }),
  content: [{ type: "text", text }],
});

afterEach(() => {
  current?.destroy();
  current = undefined;
});

describe("indent", () => {
  it("moves paragraphs right and back in steps, and keeps them in the saved JSON", () => {
    const editor = edit({ type: "doc", content: [paragraph("Verso")] });

    editor.commands.indent();
    editor.commands.indent();
    expect(editor.getJSON().content?.[0]?.attrs?.indent).toBe(2);

    editor.commands.outdent();
    expect(editor.getJSON().content?.[0]?.attrs?.indent).toBe(1);
  });

  it("stops at the margins", () => {
    const editor = edit({ type: "doc", content: [paragraph("Verso")] });

    expect(editor.commands.outdent()).toBe(false);
    for (let step = 0; step < MAX_INDENT + 2; step++) editor.commands.indent();

    expect(editor.getJSON().content?.[0]?.attrs?.indent).toBe(MAX_INDENT);
  });

  it("reads the indent back from HTML", () => {
    const editor = edit('<p data-indent="3">Carta</p><p data-indent="99">Fuera de escala</p>');

    expect(editor.getJSON().content?.map((block) => block.attrs?.indent)).toEqual([3, MAX_INDENT]);
  });
});

describe("scene break", () => {
  it("inserts a fleuron followed by a paragraph to go on writing", () => {
    const editor = edit({ type: "doc", content: [paragraph("Fin de la escena.")] });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    editor.commands.insertSceneBreak();

    expect(editor.getJSON().content?.map((block) => block.type)).toEqual([
      "paragraph",
      "sceneBreak",
      "paragraph",
    ]);
    expect(editor.view.dom.querySelector(".scene-break svg")).not.toBeNull();
  });

  it("is saved as a plain node the core and exports can read", () => {
    const editor = edit("<p>Uno</p><hr data-scene-break><p>Dos</p>");

    expect(editor.getJSON().content?.[1]).toEqual({ type: "sceneBreak" });
  });
});

describe("footnotes", () => {
  it("keep their text in the node, and are numbered in reading order", () => {
    const editor = edit({ type: "doc", content: [paragraph("Rocinante y Sancho")] });
    editor.commands.setTextSelection(10);
    editor.commands.insertFootnote("Rocín antes.");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertFootnote("El escudero.");

    const notes = footnotesOf(editor.state.doc);

    expect(notes.map((note) => [note.number, note.text])).toEqual([
      [1, "Rocín antes."],
      [2, "El escudero."],
    ]);
    expect(editor.getJSON().content?.[0]?.content?.[1]).toEqual({
      type: "footnote",
      attrs: { text: "Rocín antes." },
    });
  });

  it("can be rewritten in place", () => {
    const editor = edit({ type: "doc", content: [paragraph("Texto")] });
    editor.commands.setTextSelection(6);
    editor.commands.insertFootnote();
    const [note] = footnotesOf(editor.state.doc);

    editor.commands.setFootnoteText(note!.position, "Ahora con texto.");

    expect(footnotesOf(editor.state.doc)[0]?.text).toBe("Ahora con texto.");
    expect(editor.commands.setFootnoteText(1, "no es una nota")).toBe(false);
  });
});

describe("note anchors", () => {
  it("anchor a note over a passage without growing when typing at its edge", () => {
    const editor = edit({ type: "doc", content: [paragraph("revisar esta fecha")] });

    editor.commands.anchorNote(NOTE, { from: 9, to: 19 });
    editor.commands.setTextSelection(19);
    editor.commands.insertContent(" mañana");

    expect(anchorsOf(editor.state.doc).get(NOTE)).toEqual([{ from: 9, to: 19 }]);
    const marked = editor.getJSON().content?.[0]?.content?.find((node) => node.marks);
    expect(marked).toEqual({
      type: "text",
      text: "esta fecha",
      marks: [{ type: "noteAnchor", attrs: { noteId: NOTE } }],
    });
  });

  it("anchor a note at a point when nothing is selected", () => {
    const editor = edit({ type: "doc", content: [paragraph("aquí")] });

    editor.commands.anchorNote(NOTE, { from: 5, to: 5 });

    expect(editor.getJSON().content?.[0]?.content?.[1]).toEqual({
      type: "notePoint",
      attrs: { noteId: NOTE },
    });
    expect(anchorsOf(editor.state.doc).get(NOTE)).toEqual([{ from: 5, to: 5 }]);
  });

  it("are removed without touching the text", () => {
    const editor = edit({ type: "doc", content: [paragraph("uno dos")] });
    editor.commands.anchorNote(NOTE, { from: 1, to: 4 });
    editor.commands.anchorNote(NOTE, { from: 8, to: 8 });

    expect(editor.commands.removeNoteAnchors(NOTE)).toBe(true);

    expect(editor.getText()).toBe("uno dos");
    expect(anchorsOf(editor.state.doc).size).toBe(0);
    expect(editor.commands.removeNoteAnchors(NOTE)).toBe(false);
  });

  it("deleting the passage removes its anchor, which is what leaves the note loose", () => {
    const editor = edit({ type: "doc", content: [paragraph("borrar esto")] });
    editor.commands.anchorNote(NOTE, { from: 8, to: 12 });

    editor.commands.deleteRange({ from: 7, to: 12 });

    expect(anchorsOf(editor.state.doc).has(NOTE)).toBe(false);
  });
});

describe("book formatting", () => {
  it("offers what a manuscript needs and leaves out code and links", () => {
    const editor = edit("<p>texto</p>");
    const names = Object.keys(editor.schema.nodes).concat(Object.keys(editor.schema.marks));

    expect(names).toEqual(
      expect.arrayContaining([
        "bold",
        "italic",
        "underline",
        "heading",
        "blockquote",
        "bulletList",
        "orderedList",
      ]),
    );
    expect(names).not.toEqual(expect.arrayContaining(["code"]));
    expect(names).not.toContain("codeBlock");
    expect(names).not.toContain("link");
    expect(names).not.toContain("horizontalRule");
  });
});

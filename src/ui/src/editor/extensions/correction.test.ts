// @vitest-environment jsdom
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { bookExtensions } from ".";
import type { SpellReply } from "../../features/correction/spelling-messages";
import { acceptedWords, SpellChecker } from "../../features/correction/spelling";
import { Correction } from "./correction";

let current: Editor | undefined;

/** A speller that knows only these words, and answers at once. */
function checkerKnowing(...right: string[]) {
  let answer: (reply: SpellReply) => void = () => {};
  return new SpellChecker(() => ({
    post: (request) =>
      queueMicrotask(() =>
        answer(
          request.kind === "check"
            ? {
                kind: "checked",
                results: request.words.map((word) => [word, right.includes(word)]),
              }
            : { kind: "suggested", id: request.id, suggestions: [] },
        ),
      ),
    listen: (handler) => {
      answer = handler;
    },
  }));
}

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

async function edit(text: string, checker: SpellChecker, accepted = new Set<string>()) {
  current = new Editor({
    extensions: [...bookExtensions(), Correction],
    content: { type: "doc", content: [paragraph(text)] },
  });
  current.commands.setCorrection({ checker, accepted });
  current.commands.setCorrectionVisible(true);
  // The speller answers, and the text is marked again.
  await new Promise((resolve) => setTimeout(resolve));
  current.commands.refreshCorrection();
  return current;
}

const marked = (editor: Editor, name: string) =>
  [...editor.view.dom.querySelectorAll(`.${name}`)].map((element) => element.textContent);

afterEach(() => {
  current?.destroy();
  current = undefined;
});

describe("the marks of the correction", () => {
  it("marks the words the speller does not know, and not the names of the fichas", async () => {
    const accepted = acceptedWords([], ["Maritornes"]);
    const editor = await edit(
      "La cassa de Maritornes era grande.",
      checkerKnowing("La", "de", "era", "grande"),
      accepted,
    );

    expect(marked(editor, "misspelled")).toEqual(["cassa"]);
    expect(editor.view.dom.querySelector(".misspelled")?.getAttribute("data-word")).toBe("cassa");
  });

  it("marks the punctuation, with its message and its fix", async () => {
    const editor = await edit("Vino , y se fue", checkerKnowing("Vino", "se", "fue"));

    const mark = editor.view.dom.querySelector(".punctuation-issue");
    expect(mark?.getAttribute("data-message")).toBe("Sobra el espacio antes de «,».");
    expect(mark?.getAttribute("data-fix")).toBe("");
  });

  it("does not mark the word being typed until the cursor leaves it", async () => {
    const editor = await edit("Era", checkerKnowing("Era", "un", "hidalgo"));
    editor.chain().setTextSelection(4).insertContent(" hidalg").run();
    await new Promise((resolve) => setTimeout(resolve));
    editor.commands.refreshCorrection();
    expect(marked(editor, "misspelled")).toEqual([]);

    editor.commands.setTextSelection(1);

    expect(marked(editor, "misspelled")).toEqual(["hidalg"]);
  });

  it("hides the marks and shows them again without checking anything", async () => {
    const editor = await edit("grande cassa", checkerKnowing("grande"));
    expect(marked(editor, "misspelled")).toEqual(["cassa"]);

    editor.commands.setCorrectionVisible(false);
    expect(marked(editor, "misspelled")).toEqual([]);
    editor.commands.setCorrectionVisible(true);
    expect(marked(editor, "misspelled")).toEqual(["cassa"]);
  });

  it("never changes the text", async () => {
    const editor = await edit("La cassa , dijo.", checkerKnowing("La", "dijo"));

    expect(editor.getText()).toBe("La cassa , dijo.");
    expect(editor.can().undo()).toBe(false);
  });
});

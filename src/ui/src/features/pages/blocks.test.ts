// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ManuscriptChapter } from "../../bridge/generated/protocol";
import { chapterBlocks, withoutNotes } from "./blocks";

const NOTE = "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b";

const chapter: ManuscriptChapter = {
  id: "0196a3b2-7c4d-7e8f-9a0b-000000000001",
  title: "Que trata de la condición",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "En un lugar " },
          {
            type: "text",
            text: "de la Mancha",
            marks: [{ type: "noteAnchor", attrs: { noteId: NOTE } }],
          },
          { type: "notePoint", attrs: { noteId: NOTE } },
          { type: "footnote", attrs: { text: "Campo de Montiel." } },
        ],
      },
      { type: "sceneBreak" },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Rocinante" },
          { type: "footnote", attrs: { text: "Rocín antes." } },
        ],
      },
    ],
  },
};

describe("a chapter set for the page view", () => {
  it("opens with its title, then a block per paragraph, title or scene break", () => {
    const set = chapterBlocks(chapter, document);

    expect(set.blocks.map((block) => block.tagName)).toEqual(["H1", "P", "HR", "P"]);
    expect(set.blocks[0]).toHaveTextContent("Que trata de la condición");
    expect(set.blocks[1]).toHaveTextContent("En un lugar de la Mancha");
  });

  it("leaves out the notes of the writer, which are not part of the work", () => {
    const set = chapterBlocks(chapter, document);

    expect(set.blocks[1]!.querySelector("[data-note-id]")).toBeNull();
    expect(set.blocks[1]!.querySelector(".note-anchor, .note-point")).toBeNull();
  });

  it("numbers the footnotes of the chapter in reading order and keeps their text", () => {
    const set = chapterBlocks(chapter, document);

    const calls = set.blocks.flatMap((block) => [...block.querySelectorAll("sup.footnote")]);
    expect(calls.map((call) => (call as HTMLElement).dataset.number)).toEqual(["1", "2"]);
    expect(set.footnotes).toEqual(["Campo de Montiel.", "Rocín antes."]);
  });

  it("marks what the editor gets from neighbours: the opening paragraph and those that follow another", () => {
    const set = chapterBlocks(
      {
        ...chapter,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Uno" }] },
            { type: "paragraph", content: [{ type: "text", text: "Dos" }] },
            { type: "sceneBreak" },
            { type: "paragraph", content: [{ type: "text", text: "Tres" }] },
          ],
        },
      },
      document,
    );

    expect(set.blocks.map((block) => block.className)).toEqual([
      "page-chapter-title",
      "page-opening",
      "page-follows",
      "",
      "",
    ]);
  });

  it("an empty chapter is just its title", () => {
    const set = chapterBlocks({ ...chapter, content: { type: "doc" } }, document);

    expect(set.blocks).toHaveLength(1);
  });

  it("strips anchors at any depth and keeps everything else", () => {
    expect(
      withoutNotes({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "dicho", marks: [{ type: "italic" }, { type: "noteAnchor" }] },
              { type: "notePoint" },
            ],
          },
        ],
      }),
    ).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "dicho", marks: [{ type: "italic" }] }],
        },
      ],
    });
  });
});

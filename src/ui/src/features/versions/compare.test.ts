// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { VersionSummary } from "../../bridge/generated/protocol";
import { compare, plainText } from "./compare";
import { versionDate, versionName } from "./labels";
import { isSaveVersionShortcut, isVersionsShortcut } from "./shortcuts";

const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const text = (value: string) => ({ type: "text", text: value });

describe("the text of a version", () => {
  it("reads as the reader sees it, one line per paragraph or heading", () => {
    const document = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [text("Capítulo primero")] },
        paragraph(text("En un "), { type: "text", text: "lugar", marks: [{ type: "italic" }] }),
        { type: "sceneBreak" },
        {
          type: "blockquote",
          content: [
            paragraph(text("Dichosa edad"), { type: "footnote", attrs: { text: "Cap. XI" } }),
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph(text("adarga"))] }],
        },
      ],
    };

    expect(plainText(document)).toBe(
      "Capítulo primero\nEn un lugar\n* * *\nDichosa edad [nota al pie: Cap. XI]\nadarga",
    );
  });
});

describe("comparing", () => {
  it("marks what was added and taken out, word by word, keeping paragraphs", () => {
    const paragraphs = compare(
      "adarga antigua, rocín flaco\ny galgo corredor",
      "adarga antigua, rocín muy flaco\ny galgo",
    );

    expect(paragraphs).toEqual([
      [
        { text: "adarga antigua, rocín ", change: "same" },
        { text: "muy ", change: "added" },
        { text: "flaco", change: "same" },
      ],
      [
        { text: "y galgo", change: "same" },
        { text: " corredor", change: "removed" },
      ],
    ]);
  });

  it("finds nothing to mark in the same text", () => {
    expect(compare("igual", "igual")).toEqual([[{ text: "igual", change: "same" }]]);
  });
});

describe("naming versions", () => {
  const base: VersionSummary = {
    id: "v",
    documentId: "d",
    kind: "manual",
    name: "Antes de la batalla",
    createdAt: "2026-03-14T10:42:00",
    statistics: { words: 10, characters: 50, paragraphs: 2 },
  };

  it("says what each one is", () => {
    expect(versionName(base)).toBe("Antes de la batalla");
    expect(versionName({ ...base, name: "  " })).toBe("Guardada a mano");
    expect(versionName({ ...base, kind: "automatic", name: null })).toBe("Automática");
    expect(versionName({ ...base, kind: "beforeRestore", name: null })).toBe("Antes de restaurar");
  });

  it("dates them as a writer would", () => {
    expect(versionDate(base, new Date("2026-03-14T20:00:00"))).toBe("hoy, 10:42");
    expect(versionDate(base, new Date("2026-03-20T20:00:00"))).toBe("14 de marzo, 10:42");
  });
});

describe("the versions shortcuts", () => {
  const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  it("opens with F6 alone and keeps a version with Ctrl+S", () => {
    expect(isVersionsShortcut(press({ key: "F6" }))).toBe(true);
    expect(isVersionsShortcut(press({ key: "F6", ctrlKey: true }))).toBe(false);
    expect(isSaveVersionShortcut(press({ code: "KeyS", ctrlKey: true }))).toBe(true);
    expect(isSaveVersionShortcut(press({ code: "KeyS", metaKey: true }))).toBe(true);
    expect(isSaveVersionShortcut(press({ code: "KeyS", ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
  });
});

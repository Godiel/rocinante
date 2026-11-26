import { describe, expect, it } from "vitest";
import type { Note } from "../../bridge/generated/protocol";
import { contentFromText } from "./content";
import {
  ALL_NOTES,
  filterNotes,
  inClass,
  noteMatches,
  notesOf,
  orderNotes,
  preview,
} from "./notes-list";
import { applyNotesChange } from "./notes-state";

const CHAPTER = "0196a3b2-7c4d-7e8f-9a0b-000000000001";
const OTHER_CHAPTER = "0196a3b2-7c4d-7e8f-9a0b-000000000002";
const ANTONIO = "0196a3b2-7c4d-7e8f-9a0b-0000000000a1";
const CLAUDIO = "0196a3b2-7c4d-7e8f-9a0b-0000000000c1";

function note(id: string, text: string, more: Partial<Note> = {}): Note {
  return {
    id,
    documentId: CHAPTER,
    content: contentFromText(text),
    text,
    anchored: false,
    order: null,
    resolvedAt: null,
    elements: [],
    createdAt: `2026-11-26T10:0${id}:00.000Z`,
    updatedAt: `2026-11-26T10:0${id}:00.000Z`,
    ...more,
  };
}

const anchoredLate = note("1", "Revisar esta fecha", { anchored: true, order: 2 });
const anchoredEarly = note("2", "Aquí Antonio aún no conoce a Claudio", {
  anchored: true,
  order: 0,
  elements: [ANTONIO, CLAUDIO],
});
const loose = note("3", "El pasaje ya no está");
const idea = note("4", "Un final en el Toboso", { documentId: null });
const resolved = note("5", "Cambiar el nombre del ventero", {
  resolvedAt: "2026-11-26T11:00:00.000Z",
});
const elsewhere = note("6", "Otra batalla", {
  documentId: OTHER_CHAPTER,
  anchored: true,
  order: 0,
  elements: [ANTONIO],
});
const all = [anchoredLate, anchoredEarly, loose, idea, resolved, elsewhere];

const ids = (notes: Note[]) => notes.map((shown) => shown.id);

describe("the notes kept current", () => {
  it("takes in new and changed notes and lets go of the removed ones", () => {
    const changed = { ...loose, text: "El pasaje volvió" };

    const after = applyNotesChange([anchoredLate, loose, idea], {
      notes: [changed, resolved],
      removed: [idea.id],
      origin: "window-1",
    });

    expect(after).toEqual([anchoredLate, changed, resolved]);
  });

  it("gives back the same list when nothing changed", () => {
    const notes = [anchoredLate];

    expect(applyNotesChange(notes, { notes: [], removed: [], origin: "main" })).toBe(notes);
  });

  it("changes nothing when the same change comes twice", () => {
    const change = { notes: [idea], removed: [loose.id], origin: "main" };
    const once = applyNotesChange([loose], change);

    expect(applyNotesChange(once, change)).toEqual(once);
  });
});

describe("the list of notes", () => {
  it("leaves the resolved ones out unless they are asked for", () => {
    expect(ids(filterNotes(all, ALL_NOTES))).not.toContain(resolved.id);
    expect(ids(filterNotes(all, { ...ALL_NOTES, resolved: true }))).toContain(resolved.id);
  });

  it("filters by class: in the text, loose ideas or with fichas", () => {
    expect(ids(filterNotes(all, { ...ALL_NOTES, kind: "text" }))).toEqual(["1", "2", "3", "6"]);
    expect(ids(filterNotes(all, { ...ALL_NOTES, kind: "idea" }))).toEqual(["4"]);
    expect(ids(filterNotes(all, { ...ALL_NOTES, kind: "elements" }))).toEqual(["2", "6"]);
    expect(inClass(anchoredEarly, "text") && inClass(anchoredEarly, "elements")).toBe(true);
  });

  it("filters by chapter and by ficha, and the filters add up", () => {
    expect(ids(filterNotes(all, { ...ALL_NOTES, documentId: OTHER_CHAPTER }))).toEqual(["6"]);
    expect(ids(filterNotes(all, { ...ALL_NOTES, elementId: ANTONIO }))).toEqual(["2", "6"]);
    expect(
      ids(
        filterNotes(all, {
          ...ALL_NOTES,
          elementId: ANTONIO,
          documentId: CHAPTER,
          query: "claudio",
        }),
      ),
    ).toEqual(["2"]);
  });

  it("does not count the links with fichas in the trash", () => {
    const trash = new Set([ANTONIO]);

    expect(ids(filterNotes(all, { ...ALL_NOTES, elementId: ANTONIO }, trash))).toEqual([]);
    expect(ids(filterNotes(all, { ...ALL_NOTES, kind: "elements" }, trash))).toEqual(["2"]);
  });

  it("finds words in any order, without minding case or accents", () => {
    expect(noteMatches(anchoredEarly, "AUN claudio")).toBe(true);
    expect(noteMatches(anchoredEarly, "aquí Sancho")).toBe(false);
    expect(noteMatches(anchoredEarly, "   ")).toBe(true);
  });

  it("shows the newest first", () => {
    expect(ids(orderNotes(all))).toEqual(["6", "5", "4", "3", "2", "1"]);
  });

  it("shows a chapter in the order of its text, and then the notes whose passage went", () => {
    const chapter = filterNotes(all, { ...ALL_NOTES, documentId: CHAPTER, resolved: true });

    expect(ids(orderNotes(chapter, true))).toEqual(["2", "1", "3", "5"]);
  });

  it("gives the editor the notes of its document in the order they were written", () => {
    expect(ids(notesOf([resolved, loose, anchoredLate, idea], CHAPTER))).toEqual(["1", "3", "5"]);
  });

  it("shows the beginning of a note on one line", () => {
    expect(preview({ text: "Uno\ndos" })).toBe("Uno dos");
    expect(preview({ text: "a".repeat(200) }, 10)).toBe("aaaaaaaaa…");
  });
});

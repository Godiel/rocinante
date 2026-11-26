import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import nspell from "nspell";
import { describe, expect, it, vi } from "vitest";
import type { SpellReply, SpellRequest } from "./spelling-messages";
import { acceptedWords, leftOut, SpellChecker, wordsOf, type SpellEngine } from "./spelling";

function fakeEngine(right: ReadonlySet<string>) {
  let answer: (reply: SpellReply) => void = () => {};
  const requests: SpellRequest[] = [];
  const engine: SpellEngine = {
    post: (request) => {
      requests.push(request);
      queueMicrotask(() =>
        answer(
          request.kind === "check"
            ? { kind: "checked", results: request.words.map((word) => [word, right.has(word)]) }
            : { kind: "suggested", id: request.id, suggestions: ["casa", "cansa"] },
        ),
      );
    },
    listen: (handler) => {
      answer = handler;
    },
  };
  return { engine, requests };
}

describe("the words of the text", () => {
  it("are runs of letters, keeping an apostrophe or a hyphen inside", () => {
    expect(wordsOf("—¿Vienes, O'Brien? El franco-alemán, 1605.")).toEqual([
      { start: 2, word: "Vienes" },
      { start: 10, word: "O'Brien" },
      { start: 19, word: "El" },
      { start: 22, word: "franco-alemán" },
      { start: 37, word: "1605" },
    ]);
  });

  it("leave out one letter, numbers, acronyms and what the writer accepts", () => {
    const accepted = acceptedWords(["Clavileño"], ["Alonso Quijano", "Maritornes"]);

    expect(leftOut("y", accepted)).toBe(true);
    expect(leftOut("1605", accepted)).toBe(true);
    expect(leftOut("s2", accepted)).toBe(true);
    expect(leftOut("ADSL", accepted)).toBe(true);
    expect(leftOut("Clavileño", accepted)).toBe(true);
    expect(leftOut("clavileño", accepted)).toBe(true);
    expect(leftOut("Quijano", accepted)).toBe(true);
    expect(leftOut("maritornes", accepted)).toBe(true);
    expect(leftOut("cassa", accepted)).toBe(false);
  });
});

describe("the speller", () => {
  it("asks for the words it does not know in one batch, and tells when the answers arrive", async () => {
    const { engine, requests } = fakeEngine(new Set(["casa"]));
    const checker = new SpellChecker(() => engine);
    const answered = vi.fn();
    checker.onAnswers(answered);

    expect(checker.isCorrect("casa")).toBeUndefined();
    expect(checker.isCorrect("cassa")).toBeUndefined();
    expect(checker.isCorrect("casa")).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve));

    expect(requests).toEqual([{ kind: "check", words: ["casa", "cassa"] }]);
    expect(answered).toHaveBeenCalledTimes(1);
    expect(checker.isCorrect("casa")).toBe(true);
    expect(checker.isCorrect("cassa")).toBe(false);
  });

  it("suggests ways to write a word", async () => {
    const { engine } = fakeEngine(new Set());
    const checker = new SpellChecker(() => engine);

    expect(await checker.suggest("cassa")).toEqual(["casa", "cansa"]);
  });
});

describe("the Spanish dictionary", () => {
  it("knows Spanish words and suggests the right one", () => {
    const folder = dirname(createRequire(import.meta.url).resolve("dictionary-es"));
    const spell = nspell(
      readFileSync(join(folder, "index.aff")),
      readFileSync(join(folder, "index.dic")),
    );

    for (const word of ["casa", "Hidalgo", "acordarme", "añadidura", "rocín", "ningún"]) {
      expect(spell.correct(word), word).toBe(true);
    }
    expect(spell.correct("ningun")).toBe(false);
    expect(spell.suggest("ningun")).toContain("ningún");
  });
});

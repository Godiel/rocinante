import { describe, expect, it } from "vitest";
import { punctuationIssues } from "./punctuation";

const rules = (text: string) => punctuationIssues(text).map((issue) => issue.rule);

/** Applies every fix, as the writer would one by one, from the end so the places hold. */
function fixed(text: string): string {
  let result = text;
  for (const issue of [...punctuationIssues(text)].reverse()) {
    if (issue.fix === undefined) continue;
    result = result.slice(0, issue.start) + issue.fix + result.slice(issue.start + issue.length);
  }
  return result;
}

describe("Spanish punctuation that is right is left alone", () => {
  it.each([
    "—¿Vienes? —preguntó Sancho—. ¡Ven ya!",
    "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo.",
    "Llegó el Sr. García; luego, la Sra. Pérez: venían juntos.",
    "Compró pan, vino, queso, etc. y se fue.",
    "Eran las 10:30 y costaba 1,5 reales.",
    "¿Qué hora es? me preguntó.",
    "Y luego... nada.",
    "«Ven», dijo. «No», respondió.",
    "Página 23 (véase la nota).",
    "¡Qué día! ¿Y ahora?",
  ])("%s", (text) => {
    expect(punctuationIssues(text)).toEqual([]);
  });
});

describe("Spanish punctuation that is wrong is pointed out", () => {
  it("finds opening signs without a close, and closes without an opening", () => {
    expect(rules("¿Vienes conmigo.")).toEqual(["unclosed"]);
    expect(rules("Vienes conmigo?")).toEqual(["unopened"]);
    expect(rules("¡Ven! Qué bien!")).toEqual(["unopened"]);
    expect(punctuationIssues("¿Vienes.")[0]!.message).toBe("Este «¿» no se cierra con «?».");
  });

  it("finds spaces before a sign, and takes them away", () => {
    expect(rules("Llegó , y se fue .")).toEqual(["spaceBefore", "spaceBefore"]);
    expect(fixed("Llegó , y se fue .")).toBe("Llegó, y se fue.");
    expect(fixed("¿Vienes ?")).toBe("¿Vienes?");
  });

  it("finds a comma stuck to the next word, and puts the space", () => {
    expect(rules("Pan,vino;queso:todo.")).toEqual(["spaceAfter", "spaceAfter", "spaceAfter"]);
    expect(fixed("Pan,vino")).toBe("Pan, vino");
  });

  it("finds double spaces", () => {
    expect(fixed("Era  un   hidalgo.")).toBe("Era un hidalgo.");
  });

  it("finds a sentence that starts in a small letter, and raises it", () => {
    expect(rules("Llegó tarde. entonces se fue.")).toEqual(["lowercaseStart"]);
    expect(fixed("Llegó tarde. ángel se fue.")).toBe("Llegó tarde. Ángel se fue.");
  });

  it("finds a dialogue opened with a hyphen, and puts the long dash", () => {
    expect(rules("- Ven aquí.")).toEqual(["dialogueDash"]);
    expect(fixed("- Ven aquí.")).toBe("—Ven aquí.");
    expect(fixed("--¿Vienes?")).toBe("—¿Vienes?");
    expect(fixed("– Ven.")).toBe("—Ven.");
  });

  it("gives the problems in the order of the text", () => {
    expect(punctuationIssues("Vino ,y  se fue?").map((issue) => issue.start)).toEqual([4, 7, 15]);
  });
});

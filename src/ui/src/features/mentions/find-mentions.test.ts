import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMentions, mentionIndex } from "./find-mentions";

interface Case {
  name: string;
  text: string;
  names: Record<string, string[]>;
  mentions: { elements: string[]; start: number; length: number }[];
}

// The same cases the core passes: both sides must find exactly the same mentions.
const shared = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "..", "..", "..", "..", "contracts", "mentions.json"),
    "utf8",
  ),
) as { cases: Case[] };

describe("finding the names of the fichas in the text", () => {
  it.each(shared.cases.map((item) => [item.name, item] as const))("%s", (_, item) => {
    const index = mentionIndex(
      Object.entries(item.names).map(([id, [name, ...aliases]]) => ({
        id,
        name: name ?? "",
        aliases,
      })),
    );

    expect(findMentions(item.text, index)).toEqual(item.mentions);
  });

  it("finds nothing without names", () => {
    expect(findMentions("Antonio llegó.", mentionIndex([]))).toEqual([]);
  });

  it("does not take words split by a line, or too far apart, for a name", () => {
    const index = mentionIndex([{ id: "q", name: "Don Quijote", aliases: [] }]);

    expect(findMentions("Don\nQuijote", index)).toEqual([]);
    expect(findMentions("Don … — Quijote", index)).toEqual([]);
    expect(findMentions("Llegó Don", index)).toEqual([]);
  });

  it("counts the same name of one ficha once", () => {
    const index = mentionIndex([{ id: "a", name: "Antonio", aliases: ["ANTONIO"] }]);

    expect(findMentions("Antonio", index)).toEqual([{ elements: ["a"], start: 0, length: 7 }]);
  });
});

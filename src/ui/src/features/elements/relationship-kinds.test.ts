import { describe, expect, it } from "vitest";
import type { Relationship, RelationshipKind } from "../../bridge/generated/protocol";
import { COMMON_KINDS, isSymmetric, labelFrom, repeats, wordsOf } from "./relationship-kinds";

const squire: RelationshipKind = {
  id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
  forward: "escudero de",
  inverse: "señor de",
};
const rival: RelationshipKind = {
  id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6c",
  forward: "rival de",
  inverse: null,
};
const own = [squire, rival];

function related(id: string, from: string, to: string, kind: string): Relationship {
  return { id, from, to, kind, starts: null, ends: null };
}

describe("kinds of relationship", () => {
  it("have ids the contract accepts and are not repeated", () => {
    const ids = COMMON_KINDS.map((kind) => kind.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^builtin:[a-z0-9-]{1,40}$/);
  });

  it("read from each side", () => {
    const son = related("r", "claudio", "antonio", "builtin:child-of");
    const service = related("s", "sancho", "quijote", squire.id);

    expect(labelFrom(son, "claudio", own)).toBe("hijo de");
    expect(labelFrom(son, "antonio", own)).toBe("padre de");
    expect(labelFrom(service, "quijote", own)).toBe("señor de");
    expect(labelFrom(related("t", "a", "b", "builtin:sibling-of"), "b", own)).toBe("hermano de");
  });

  it("know which are symmetric, and a kind no longer known reads as related", () => {
    expect(isSymmetric("builtin:sibling-of", own)).toBe(true);
    expect(isSymmetric(rival.id, own)).toBe(true);
    expect(isSymmetric("builtin:child-of", own)).toBe(false);
    expect(wordsOf("builtin:vanished", own)).toEqual({
      id: "builtin:vanished",
      forward: "relacionado con",
      inverse: null,
    });
  });

  it("spot a repeated relationship, both ways round when symmetric", () => {
    const existing = [
      related("r", "a", "b", "builtin:sibling-of"),
      related("s", "a", "b", "builtin:child-of"),
    ];

    expect(repeats(existing, "b", "a", "builtin:sibling-of", own)).toBe(true);
    expect(repeats(existing, "a", "b", "builtin:child-of", own)).toBe(true);
    expect(repeats(existing, "b", "a", "builtin:child-of", own)).toBe(false);
    expect(repeats(existing, "a", "b", "builtin:child-of", own, "s")).toBe(false);
  });
});

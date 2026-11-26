import { describe, expect, it } from "vitest";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { byName, folded, matches, sharedNames } from "./search";

function element(id: string, name: string, aliases: string[] = []): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases,
    position: { x: 0, y: 0 },
    image: null,
  };
}

describe("looking for elements", () => {
  it("ignores case and accents", () => {
    expect(folded("  QUIJÁNO ")).toBe("quijano");
    expect(folded("Ñaque")).toBe("naque");
  });

  it("finds an element by its name or by any alias", () => {
    const quixote = element("1", "Alonso Quijano", ["el Caballero de la Triste Figura"]);

    expect(matches(quixote, "quijano")).toBe(true);
    expect(matches(quixote, "TRISTE figura")).toBe(true);
    expect(matches(quixote, "Sancho")).toBe(false);
    expect(matches(quixote, "   ")).toBe(true);
  });

  it("sorts in Spanish order", () => {
    const sorted = byName([
      element("1", "Zoraida"),
      element("2", "Ñaque"),
      element("3", "Ángela"),
      element("4", "nadie"),
    ]);

    expect(sorted.map((each) => each.name)).toEqual(["Ángela", "nadie", "Ñaque", "Zoraida"]);
    expect(
      byName([element("1", "Juan 10"), element("2", "Juan 2")]).map((each) => each.name),
    ).toEqual(["Juan 2", "Juan 10"]);
  });
});

describe("shared names", () => {
  it("tells each element which others go by one of its names", () => {
    const shared = sharedNames([
      element("a", "Juan"),
      element("b", "Juan Haldudo"),
      element("c", "el amo", ["juan"]),
      element("d", "Sancho", ["Sancho Panza"]),
    ]);

    expect(shared.get("a")).toEqual(["c"]);
    expect(shared.get("c")).toEqual(["a"]);
    expect(shared.has("b")).toBe(false);
    expect(shared.has("d")).toBe(false);
  });

  it("joins every element that shares any name", () => {
    const shared = sharedNames([
      element("a", "Juan", ["Maese"]),
      element("b", "Juan"),
      element("c", "Maese"),
    ]);

    expect(shared.get("a")?.sort()).toEqual(["b", "c"]);
    expect(shared.get("b")).toEqual(["a"]);
  });
});

import { describe, expect, it } from "vitest";
import { arrange } from "./arrange";
import { CARD } from "./placement";

function card(id: string, x: number, y: number) {
  return { id, position: { x, y } };
}

/** A small work: a family, a place where some live, and a stranger. */
const elements = [
  card("a", 0, 0),
  card("b", 10, 5),
  card("c", 20, 10),
  card("d", 0, 0),
  card("e", 400, -300),
  card("f", -800, 900),
];
const relationships = [
  { from: "b", to: "a" },
  { from: "c", to: "a" },
  { from: "b", to: "c" },
  { from: "a", to: "e" },
  { from: "b", to: "e" },
];

function overlaps(places: Map<string, { x: number; y: number }>): string[] {
  const list = [...places];
  const found: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [idA, a] = list[i]!;
      const [idB, b] = list[j]!;
      if (Math.abs(a.x - b.x) < CARD.width && Math.abs(a.y - b.y) < CARD.height)
        found.push(`${idA}-${idB}`);
    }
  return found;
}

const distance = (p: { x: number; y: number }, q: { x: number; y: number }) =>
  Math.hypot(p.x - q.x, p.y - q.y);

describe("arranging the board", () => {
  it("gives the same places every time for the same board", () => {
    expect([...arrange(elements, relationships)]).toEqual([...arrange(elements, relationships)]);
  });

  it("leaves no two cards over each other, even when they started in the same place", () => {
    const places = arrange(elements, relationships);

    expect(places.size).toBe(elements.length);
    expect(overlaps(places)).toEqual([]);
  });

  it("brings related cards closer than unrelated ones", () => {
    const places = arrange(elements, relationships);
    const family = distance(places.get("a")!, places.get("b")!);
    const stranger = distance(places.get("a")!, places.get("f")!);

    expect(family).toBeLessThan(stranger);
  });

  it("keeps whole numbers within the board, and does nothing with no cards", () => {
    for (const { x, y } of arrange(elements, relationships).values()) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(Math.abs(x)).toBeLessThan(1_000_000);
    }
    expect(arrange([], []).size).toBe(0);
  });

  it("ignores relationships with a card that is not there", () => {
    expect(() => arrange([card("a", 0, 0)], [{ from: "a", to: "gone" }])).not.toThrow();
  });

  it("copes with many cards", () => {
    const many = Array.from({ length: 120 }, (_, index) => card(`n${index}`, index % 7, index % 5));
    const links = many.slice(1).map((one, index) => ({ from: one.id, to: many[index]!.id }));

    expect(overlaps(arrange(many, links))).toEqual([]);
  });
});

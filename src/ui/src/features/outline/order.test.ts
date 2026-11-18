import { describe, expect, it } from "vitest";
import { moveOver, placeOf, roman, type Order } from "./order";

const order: Order = { chapter: ["a", "b", "c"], fragment: ["x", "y"] };

describe("dragging in the index", () => {
  it("reorders chapters among themselves", () => {
    expect(moveOver(order, "a", "c").chapter).toEqual(["b", "c", "a"]);
    expect(moveOver(order, "c", "a").chapter).toEqual(["c", "a", "b"]);
  });

  it("turns a fragment into a chapter when it is dragged among the chapters", () => {
    const moved = moveOver(order, "y", "b");
    expect(moved).toEqual({ chapter: ["a", "y", "b", "c"], fragment: ["x"] });
    expect(placeOf(moved, "y")).toEqual({ kind: "chapter", position: 1 });
  });

  it("drops into an empty list", () => {
    const empty: Order = { chapter: ["a"], fragment: [] };
    expect(moveOver(empty, "a", "fragment")).toEqual({ chapter: [], fragment: ["a"] });
  });

  it("leaves the order alone over itself or nowhere known", () => {
    expect(moveOver(order, "a", "a")).toBe(order);
    expect(moveOver(order, "a", "chapter")).toBe(order);
    expect(moveOver(order, "z", "a")).toBe(order);
  });
});

describe("chapter numerals", () => {
  it("counts as the old books did", () => {
    expect([1, 4, 9, 14, 40, 52, 90, 1605].map(roman)).toEqual([
      "I",
      "IV",
      "IX",
      "XIV",
      "XL",
      "LII",
      "XC",
      "MDCV",
    ]);
  });
});

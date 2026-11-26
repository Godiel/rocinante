import { describe, expect, it } from "vitest";
import {
  LAYOUT,
  chapterPlaces,
  holdsAt,
  limitsOf,
  milestonesByPlace,
  radiusFor,
  shortened,
} from "./layout";

const places = chapterPlaces({
  chapters: [
    { documentId: "uno", title: "Uno" },
    { documentId: "dos", title: "Dos" },
    { documentId: "tres", title: "Tres" },
  ],
});

describe("the drawing of the threads", () => {
  it("draws a point larger the more a ficha is named, up to a limit", () => {
    expect(radiusFor(1)).toBe(LAYOUT.minRadius);
    expect(radiusFor(5)).toBeGreaterThan(radiusFor(2));
    expect(radiusFor(10_000)).toBe(LAYOUT.maxRadius);
  });

  it("tells when a relationship holds, both chapters included", () => {
    const friends = { starts: "uno", ends: "dos" };
    expect(holdsAt(friends, 0, places)).toBe(true);
    expect(holdsAt(friends, 1, places)).toBe(true);
    expect(holdsAt(friends, 2, places)).toBe(false);
    expect(holdsAt({ starts: "tres", ends: null }, 1, places)).toBe(false);
    expect(holdsAt({ starts: null, ends: null }, 2, places)).toBe(true);
  });

  it("does not count a limit whose chapter is gone", () => {
    expect(holdsAt({ starts: "borrado", ends: "uno" }, 0, places)).toBe(true);
    expect(limitsOf({ starts: "borrado", ends: "dos" }, places)).toEqual({ starts: null, ends: 1 });
  });

  it("groups the milestones by ficha and chapter, in order", () => {
    const milestone = (id: string, elementId: string, documentId: string) => ({
      id,
      elementId,
      documentId,
      passage: "",
      text: id,
      lost: false,
      createdAt: "2026-11-26T10:00:00.000Z",
    });
    const by = milestonesByPlace([
      milestone("a", "antonio", "uno"),
      milestone("b", "antonio", "uno"),
      milestone("c", "claudio", "uno"),
    ]);
    expect(by.get("antonio:uno")?.map((each) => each.id)).toEqual(["a", "b"]);
    expect(by.get("claudio:uno")).toHaveLength(1);
  });

  it("cuts a long sentence to fit under its point", () => {
    expect(shortened("Muere su padre")).toBe("Muere su padre");
    expect(shortened("Descubre la carta de su madre", 12)).toBe("Descubre la…");
  });
});

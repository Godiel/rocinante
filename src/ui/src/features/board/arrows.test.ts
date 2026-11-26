import { describe, expect, it } from "vitest";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { arrowsFor } from "./edges";
import { arrowPath, borderToward } from "./geometry";

function summary(id: string, name: string): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases: [],
    position: { x: 0, y: 0 },
    image: null,
  };
}

const people = [summary("a", "Antonio"), summary("c", "Claudio")];

describe("the arrows of the board", () => {
  it("read forward, with a point only where the kind has two sides", () => {
    const [child, sibling] = arrowsFor(
      [
        { id: "1", from: "c", to: "a", kind: "builtin:child-of", starts: null, ends: null },
        { id: "2", from: "a", to: "c", kind: "builtin:sibling-of", starts: null, ends: null },
      ],
      people,
      [],
    );

    expect(child).toMatchObject({ source: "c", target: "a", ariaLabel: "Claudio hijo de Antonio" });
    expect(child!.data).toMatchObject({ label: "hijo de", symmetric: false, bend: 0 });
    expect(sibling!.data).toMatchObject({ symmetric: true, bend: 1 });
  });

  it("bends the ones between the same fichas to either side, and leaves out what has no card", () => {
    const arrows = arrowsFor(
      [
        ...["1", "2", "3", "4"].map((id) => ({
          id,
          from: "a",
          to: "c",
          kind: `own:${id}`,
          starts: null,
          ends: null,
        })),
        { id: "5", from: "a", to: "gone", kind: "builtin:friend-of", starts: null, ends: null },
      ],
      people,
      [],
    );

    expect(arrows.map((arrow) => arrow.data!.bend)).toEqual([0, 1, -1, 2]);
    expect(arrows[0]!.data!.label).toBe("relacionado con");
  });
});

describe("drawing an arrow", () => {
  const left = { x: 0, y: 0, width: 200, height: 100 };
  const right = { x: 400, y: 0, width: 200, height: 100 };

  it("leaves each card at its border", () => {
    expect(borderToward(left, { x: 500, y: 50 })).toEqual({ x: 200, y: 50 });
    expect(arrowPath(left, right, 0).path).toBe("M 200,50 Q 300,50 400,50");
  });

  it("bends to opposite sides, whichever way the arrow goes", () => {
    const one = arrowPath(left, right, 1).middle;
    const back = arrowPath(right, left, 1).middle;
    const other = arrowPath(left, right, -1).middle;

    expect(one.y).toBeCloseTo(back.y);
    expect(Math.sign(one.y - 50)).toBe(-Math.sign(other.y - 50));
  });
});

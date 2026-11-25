import { describe, expect, it } from "vitest";
import { CELL, freePlaceNear } from "./placement";

const at = (x: number, y: number) => ({ position: { x, y } });

describe("placing a new card", () => {
  it("takes the centre when it is free", () => {
    expect(freePlaceNear({ x: 10.4, y: -20.6 }, [])).toEqual({ x: 10, y: -21 });
  });

  it("goes round the centre, ring by ring, to the first place no card covers", () => {
    const taken = [at(0, 0)];
    expect(freePlaceNear({ x: 0, y: 0 }, taken)).toEqual({ x: -CELL.width, y: -CELL.height });

    const crowded = [-1, 0, 1].flatMap((column) =>
      [-1, 0, 1].map((row) => at(column * CELL.width, row * CELL.height)),
    );
    const place = freePlaceNear({ x: 0, y: 0 }, crowded);
    expect(Math.max(Math.abs(place.x / CELL.width), Math.abs(place.y / CELL.height))).toBe(2);
  });

  it("does not take a place a card only half covers", () => {
    const place = freePlaceNear({ x: 0, y: 0 }, [at(CELL.width / 2, CELL.height / 2)]);
    expect(place).not.toEqual({ x: 0, y: 0 });
  });
});

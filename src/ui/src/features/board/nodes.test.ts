import { describe, expect, it } from "vitest";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { cardsFor } from "./nodes";

function summary(id: string, x: number, y: number): ElementSummary {
  return {
    id,
    kind: "place",
    otherKind: null,
    name: `Lugar ${id}`,
    aliases: [],
    position: { x, y },
    image: null,
  };
}

describe("the cards of the board", () => {
  it("puts each element where the work has it, named for screen readers", () => {
    const [card] = cardsFor([summary("a", 10, 20)], []);
    expect(card).toMatchObject({ id: "a", type: "card", position: { x: 10, y: 20 } });
    expect(card!.ariaLabel).toBe("Lugar a, Lugar");
  });

  it("keeps a card where the hand has it while it moves, and what is selected", () => {
    const [moving] = cardsFor([summary("a", 0, 0)], []);
    const held = { ...moving!, position: { x: 300, y: 40 }, dragging: true, selected: true };

    const [after] = cardsFor([summary("a", 0, 0)], [held]);

    expect(after!.position).toEqual({ x: 300, y: 40 });
    expect(after!.selected).toBe(true);
  });

  it("takes a move from another window when the card is still", () => {
    const [still] = cardsFor([summary("a", 0, 0)], []);
    const [after] = cardsFor([summary("a", 520, 0)], [{ ...still!, selected: true }]);

    expect(after!.position).toEqual({ x: 520, y: 0 });
    expect(after!.selected).toBe(true);
  });
});

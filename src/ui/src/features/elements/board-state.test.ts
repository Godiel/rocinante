import { describe, expect, it } from "vitest";
import type { Board, ElementSummary } from "../../bridge/generated/protocol";
import { applyChange, EMPTY_BOARD, type ElementsChange } from "./board-state";

function element(id: string, name: string, x = 0): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases: [],
    position: { x, y: 0 },
    image: null,
  };
}

function change(parts: Partial<ElementsChange>): ElementsChange {
  return {
    elements: [],
    trash: [],
    details: [],
    relationships: [],
    removedRelationships: [],
    ownKinds: [],
    origin: "main",
    ...parts,
  };
}

const quixote = element("q", "Don Quijote");
const sancho = element("s", "Sancho");
const son = { id: "r", from: "s", to: "q", kind: "builtin:child-of", starts: null, ends: null };

describe("the board after a change", () => {
  it("adds new elements and replaces changed ones in place", () => {
    const board = applyChange(EMPTY_BOARD, change({ elements: [quixote, sancho] }));
    const moved = applyChange(board, change({ elements: [element("q", "Don Quijote", 300)] }));

    expect(moved.elements.map((each) => [each.id, each.position.x])).toEqual([
      ["q", 300],
      ["s", 0],
    ]);
  });

  it("moves an element to the trash and back", () => {
    const board: Board = { ...EMPTY_BOARD, elements: [quixote, sancho], relationships: [son] };

    const deleted = applyChange(board, change({ trash: [sancho], removedRelationships: ["r"] }));
    expect(deleted.elements).toEqual([quixote]);
    expect(deleted.trash).toEqual([sancho]);
    expect(deleted.relationships).toEqual([]);

    const restored = applyChange(deleted, change({ elements: [sancho], relationships: [son] }));
    expect(restored.elements).toEqual([quixote, sancho]);
    expect(restored.trash).toEqual([]);
    expect(restored.relationships).toEqual([son]);
  });

  it("adds the writer's new kinds and leaves the board as it was when applied twice", () => {
    const kind = {
      id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
      forward: "escudero de",
      inverse: "señor de",
    };
    const once = applyChange(
      EMPTY_BOARD,
      change({ elements: [quixote], relationships: [son], ownKinds: [kind] }),
    );
    const twice = applyChange(
      once,
      change({ elements: [quixote], relationships: [son], ownKinds: [kind] }),
    );

    expect(twice).toEqual(once);
    expect(twice.ownKinds).toEqual([kind]);
  });
});

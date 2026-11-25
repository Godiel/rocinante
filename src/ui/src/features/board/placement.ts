import type { BoardPosition, ElementSummary } from "../../bridge/generated/protocol";

/** The room a card takes on the board, gap included: the same cells the core uses to place a new one. */
export const CELL = { width: 260, height: 120 } as const;

/** The card itself, inside its cell. */
export const CARD = { width: 220, height: 88 } as const;

const MAX_RINGS = 200;
const LIMIT = 1_000_000;

/** The cells of one ring around the centre, clockwise from the top left, as the core walks them. */
function* ring(n: number): Generator<[number, number]> {
  if (n === 0) {
    yield [0, 0];
    return;
  }
  for (let column = -n; column < n; column++) yield [column, -n];
  for (let row = -n; row < n; row++) yield [n, row];
  for (let column = n; column > -n; column--) yield [column, n];
  for (let row = n; row > -n; row--) yield [-n, row];
}

/**
 * The free place nearest `centre`, looking ring by ring around it, where a new card would not cover another.
 * `centre` is where the card's top left corner would go.
 */
export function freePlaceNear(
  centre: BoardPosition,
  elements: readonly Pick<ElementSummary, "position">[],
): BoardPosition {
  const start = { x: Math.round(centre.x), y: Math.round(centre.y) };
  for (let n = 0; n <= MAX_RINGS; n++) {
    for (const [column, row] of ring(n)) {
      const x = start.x + column * CELL.width;
      const y = start.y + row * CELL.height;
      if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT) continue;
      const covered = elements.some(
        ({ position }) =>
          Math.abs(position.x - x) < CELL.width && Math.abs(position.y - y) < CELL.height,
      );
      if (!covered) return { x, y };
    }
  }
  return start;
}

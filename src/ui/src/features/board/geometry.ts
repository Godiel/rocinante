/** A card on the board, in the coordinates of the board. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

const BEND_STEP = 48;

export function centreOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where a line from the centre of a card towards `toward` leaves the card. */
export function borderToward(box: Box, toward: Point): Point {
  const centre = centreOf(box);
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const scale = Math.min(
    dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.height / 2 / Math.abs(dy),
  );
  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

/**
 * The arrow between two cards: from border to border, bent to one side by `bend` steps. Returns the SVG path and
 * the middle of the curve, where the label goes.
 */
export function arrowPath(from: Box, to: Box, bend: number): { path: string; middle: Point } {
  const a = centreOf(from);
  const b = centreOf(to);
  // The bend is always measured from the same end of the pair, so the arrows either way do not cross.
  const [p, q] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a];
  const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const normal = { x: -(q.y - p.y) / length, y: (q.x - p.x) / length };
  const control = {
    x: (a.x + b.x) / 2 + normal.x * bend * BEND_STEP * 2,
    y: (a.y + b.y) / 2 + normal.y * bend * BEND_STEP * 2,
  };
  const start = borderToward(from, control);
  const end = borderToward(to, control);
  const middle = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
  };
  return { path: `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`, middle };
}

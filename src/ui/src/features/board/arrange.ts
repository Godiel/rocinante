import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { BoardPosition, ElementSummary, Relationship } from "../../bridge/generated/protocol";
import { CARD } from "./placement";

/** Room left between two cards once arranged. */
const GAP = 32;
const TICKS = 300;
const MAX_SEPARATION_ROUNDS = 200;

interface Body extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
}

/**
 * Places the cards by their relationships: related cards draw together, all of them push apart, and no two
 * overlap. The same board always gives the same places: the simulation starts where the cards are, runs a fixed
 * number of steps without animation, and d3's own randomness is seeded.
 */
export function arrange(
  elements: readonly Pick<ElementSummary, "id" | "position">[],
  relationships: readonly Pick<Relationship, "from" | "to">[],
): Map<string, BoardPosition> {
  if (elements.length === 0) return new Map();
  // Centres, so the forces think of cards as the middle of their rectangle.
  const bodies: Body[] = elements.map(({ id, position }) => ({
    id,
    x: position.x + CARD.width / 2,
    y: position.y + CARD.height / 2,
  }));
  const middle = {
    x: bodies.reduce((sum, body) => sum + body.x, 0) / bodies.length,
    y: bodies.reduce((sum, body) => sum + body.y, 0) / bodies.length,
  };
  const known = new Set(bodies.map((body) => body.id));
  const links: SimulationLinkDatum<Body>[] = relationships
    .filter((link) => known.has(link.from) && known.has(link.to) && link.from !== link.to)
    .map((link) => ({ source: link.from, target: link.to }));

  const reach = Math.hypot(CARD.width, CARD.height) / 2 + GAP / 2;
  forceSimulation(bodies)
    .force(
      "link",
      forceLink<Body, SimulationLinkDatum<Body>>(links)
        .id((body) => body.id)
        .distance(CARD.width + GAP * 2),
    )
    .force("charge", forceManyBody<Body>().strength(-900))
    .force("collide", forceCollide<Body>(reach))
    .force("x", forceX<Body>(middle.x).strength(0.04))
    .force("y", forceY<Body>(middle.y).strength(0.04))
    .stop()
    .tick(TICKS);

  separate(bodies);

  return new Map(
    bodies.map((body) => [
      body.id,
      {
        x: Math.round(body.x - CARD.width / 2),
        y: Math.round(body.y - CARD.height / 2),
      },
    ]),
  );
}

/** Pushes apart, along the shorter way out, any two cards the forces left touching. */
function separate(bodies: Body[]) {
  const width = CARD.width + GAP;
  const height = CARD.height + GAP;
  for (let round = 0; round < MAX_SEPARATION_ROUNDS; round++) {
    let moved = false;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!;
        const b = bodies[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = width - Math.abs(dx);
        const overlapY = height - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (overlapX / width < overlapY / height) {
          const push = (overlapX / 2) * (dx >= 0 ? 1 : -1);
          a.x -= push;
          b.x += push;
        } else {
          const push = (overlapY / 2) * (dy >= 0 ? 1 : -1);
          a.y -= push;
          b.y += push;
        }
      }
    }
    if (!moved) return;
  }
}

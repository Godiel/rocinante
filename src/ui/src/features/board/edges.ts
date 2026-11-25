import type { Edge } from "@xyflow/react";
import type {
  ElementSummary,
  Relationship,
  RelationshipKind,
} from "../../bridge/generated/protocol";
import { wordsOf } from "../elements/relationship-kinds";

export interface RelationEdgeData extends Record<string, unknown> {
  relationship: Relationship;
  label: string;
  symmetric: boolean;
  /** How far this arrow bends from the straight line, so several between the same fichas do not overlap. */
  bend: number;
  /** Opens the arrow to change or remove it. */
  onEdit?: () => void;
}

export type RelationEdge = Edge<RelationEdgeData, "relation">;

/** 0, 1, -1, 2, -2…: the first arrow between two fichas goes straight, the next ones to either side. */
function bendFor(index: number): number {
  if (index === 0) return 0;
  const step = Math.ceil(index / 2);
  return index % 2 === 1 ? step : -step;
}

/** The arrows for the relationships of the work, read forward and named for screen readers. */
export function arrowsFor(
  relationships: readonly Relationship[],
  elements: readonly Pick<ElementSummary, "id" | "name">[],
  ownKinds: readonly RelationshipKind[],
): RelationEdge[] {
  const names = new Map(elements.map((element) => [element.id, element.name]));
  const seen = new Map<string, number>();
  const arrows: RelationEdge[] = [];
  for (const relationship of relationships) {
    const from = names.get(relationship.from);
    const to = names.get(relationship.to);
    if (from === undefined || to === undefined) continue;
    const pair = [relationship.from, relationship.to].sort().join("|");
    const index = seen.get(pair) ?? 0;
    seen.set(pair, index + 1);
    const words = wordsOf(relationship.kind, ownKinds);
    arrows.push({
      id: relationship.id,
      type: "relation",
      source: relationship.from,
      target: relationship.to,
      ariaLabel: `${from} ${words.forward} ${to}`,
      data: {
        relationship,
        label: words.forward,
        symmetric: words.inverse === null,
        bend: bendFor(index),
      },
    });
  }
  return arrows;
}

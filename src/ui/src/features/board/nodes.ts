import type { Node } from "@xyflow/react";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { kindLabel } from "../elements/kinds";

export type CardNode = Node<{ element: ElementSummary }, "card">;

/**
 * The cards for the elements of the work. A card the writer is moving keeps where the hand has it, and every
 * card keeps whether it is selected: a change from another window should not drop either.
 */
export function cardsFor(
  elements: readonly ElementSummary[],
  previous: readonly CardNode[],
): CardNode[] {
  const before = new Map(previous.map((node) => [node.id, node]));
  return elements.map((element) => {
    const was = before.get(element.id);
    // The same element as before: the same card, wherever the hand has it.
    if (was && was.data.element === element) return was;
    return {
      id: element.id,
      type: "card",
      position: was?.dragging ? was.position : { x: element.position.x, y: element.position.y },
      data: { element },
      ariaLabel: `${element.name}, ${kindLabel(element)}`,
      selected: was?.selected ?? false,
      dragging: was?.dragging ?? false,
      measured: was?.measured,
    };
  });
}

/** How a card looks on top of where it is: hidden by the kind filter, faded by a highlight. */
export interface CardLook {
  hidden: boolean;
  className: string | undefined;
}

const dressed = new WeakMap<CardNode, { look: CardLook; node: CardNode }>();

/**
 * A card with its look. The same card with the same look is the same object as last time, so React Flow
 * redraws only the cards that changed: while one card moves, the other hundreds stay as they are.
 */
export function dress(node: CardNode, look: CardLook): CardNode {
  const before = dressed.get(node);
  if (before && before.look.hidden === look.hidden && before.look.className === look.className) {
    return before.node;
  }
  const result = { ...node, hidden: look.hidden, className: look.className };
  dressed.set(node, { look, node: result });
  return result;
}

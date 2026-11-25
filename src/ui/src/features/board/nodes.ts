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

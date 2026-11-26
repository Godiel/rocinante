import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from "@xyflow/react";
import type { RelationEdge } from "./edges";
import { arrowPath, type Box } from "./geometry";
import { CARD } from "./placement";

function boxOf(node: ReturnType<typeof useInternalNode>): Box | null {
  if (!node) return null;
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? CARD.width,
    height: node.measured.height ?? CARD.height,
  };
}

/**
 * A relationship on the board: a line from card to card with its words in the middle, and a point at the end
 * unless it reads the same both ways. It follows the cards, not fixed handles.
 */
export function RelationArrow({
  source,
  target,
  data,
  selected,
  markerEnd,
}: EdgeProps<RelationEdge>) {
  const from = boxOf(useInternalNode(source));
  const to = boxOf(useInternalNode(target));
  if (!from || !to || !data) return null;
  const { path, middle } = arrowPath(from, to, data.bend);

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={data.symmetric ? undefined : markerEnd}
        className={`board-arrow${selected ? " board-arrow-selected" : ""}`}
        interactionWidth={16}
      />
      <EdgeLabelRenderer>
        {/* The words are what the hand reaches for: a click on them opens the arrow, as on the line. */}
        <span
          className={`board-arrow-label small-caps nodrag nopan${selected ? " board-arrow-label-selected" : ""}`}
          style={{ transform: `translate(-50%, -50%) translate(${middle.x}px, ${middle.y}px)` }}
          onClick={data.onEdit}
          aria-hidden="true"
        >
          {data.label}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}

import type { NodeProps } from "@xyflow/react";
import { useElementImage } from "../elements/images";
import { kindLabel } from "../elements/kinds";
import type { CardNode } from "./nodes";

/** A ficha on the board: its picture, its name and what it is. */
export function ElementCard({ data: { element }, selected }: NodeProps<CardNode>) {
  const thumbnail = useElementImage(element.id, element.image, "thumbnail");
  return (
    <div
      className={`board-card board-card-${element.kind}${selected ? " board-card-selected" : ""}`}
    >
      {thumbnail ? (
        <img className="board-card-image" src={thumbnail} alt="" />
      ) : (
        <span className="board-card-image board-card-initial" aria-hidden="true">
          {element.name.slice(0, 1)}
        </span>
      )}
      <span className="board-card-text">
        <span className="board-card-name">{element.name}</span>
        <span className="board-card-kind small-caps">{kindLabel(element)}</span>
      </span>
    </div>
  );
}

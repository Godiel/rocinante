import { useEffect, useRef } from "react";
import type { Board } from "../../bridge/generated/protocol";
import { ElementRelations } from "./ElementRelations";
import { ElementSheet } from "./ElementSheet";
import { useElement } from "./useBoard";

export interface OpenElementSheetProps {
  id: string;
  field: "name" | "kind" | null;
  /** The work, for the other names and the relationships. */
  board: Board;
  origin: string;
  chooseImage(): Promise<string | null>;
  onOpen(id: string): void;
  onProblem(message: string | null): void;
}

/**
 * The ficha of one element, loaded and kept current: the same beside the text and beside the board. A ficha
 * just created takes the keyboard to the field the writer goes to first.
 */
export function OpenElementSheet({
  id,
  field,
  board,
  origin,
  onOpen,
  onProblem,
  ...props
}: OpenElementSheetProps) {
  const element = useElement(id);
  const frame = useRef<HTMLDivElement>(null);
  const ready = element !== null;

  // A new ficha starts at its name, or at its kind when the name came from the text.
  useEffect(() => {
    if (!ready || !field) return;
    const target = frame.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      field === "name" ? ".element-name" : ".element-kind select",
    );
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [ready, field]);

  return (
    <div ref={frame}>
      {element ? (
        <>
          <ElementSheet
            key={id}
            element={element}
            others={board.elements}
            origin={origin}
            onOpen={onOpen}
            onProblem={onProblem}
            {...props}
          />
          <ElementRelations
            elementId={id}
            board={board}
            origin={origin}
            onOpen={onOpen}
            onProblem={onProblem}
          />
        </>
      ) : (
        <p className="elements-empty">Abriendo la ficha…</p>
      )}
    </div>
  );
}

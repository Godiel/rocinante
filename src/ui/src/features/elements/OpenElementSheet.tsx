import { useEffect, useRef } from "react";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { ElementSheet } from "./ElementSheet";
import { useElement } from "./useBoard";

export interface OpenElementSheetProps {
  id: string;
  field: "name" | "kind" | null;
  others: readonly ElementSummary[];
  origin: string;
  chooseImage(): Promise<string | null>;
  onOpen(id: string): void;
  onProblem(message: string | null): void;
}

/**
 * The ficha of one element, loaded and kept current: the same beside the text and beside the board. A ficha
 * just created takes the keyboard to the field the writer goes to first.
 */
export function OpenElementSheet({ id, field, ...props }: OpenElementSheetProps) {
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
        <ElementSheet key={id} element={element} {...props} />
      ) : (
        <p className="elements-empty">Abriendo la ficha…</p>
      )}
    </div>
  );
}

import type { ElementKind, ElementSummary } from "../../bridge/generated/protocol";

/** The kinds in the order the list and the board show them. */
export const KINDS: readonly ElementKind[] = ["character", "place", "plot", "other"];

/** How each kind is named: one of them, and the group in the list. */
export const KIND_NAMES: Record<ElementKind, { one: string; group: string }> = {
  character: { one: "Personaje", group: "Personajes" },
  place: { one: "Lugar", group: "Lugares" },
  plot: { one: "Trama", group: "Tramas" },
  other: { one: "Otro", group: "Otros" },
};

/**
 * The attributes a new element of each kind starts with, empty. The writer may take them away; to the core
 * they are attributes like any other.
 */
export const SUGGESTED_ATTRIBUTES: Record<ElementKind, readonly string[]> = {
  character: ["Edad", "Aspecto", "Carácter"],
  place: ["Situación", "Aspecto"],
  plot: ["Conflicto", "Desenlace"],
  other: [],
};

export function suggestedAttributes(kind: ElementKind): { name: string; value: string }[] {
  return SUGGESTED_ATTRIBUTES[kind].map((name) => ({ name, value: "" }));
}

/** What an element is, in words: «Personaje», or the writer's own word for another kind («Objeto»). */
export function kindLabel(element: Pick<ElementSummary, "kind" | "otherKind">): string {
  return element.kind === "other" && element.otherKind
    ? element.otherKind
    : KIND_NAMES[element.kind].one;
}

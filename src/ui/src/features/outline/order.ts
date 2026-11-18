import type { DocumentKind, ProjectIndex } from "../../bridge/generated/protocol";

/** The ids of the two lists the writer can drag between, in the order shown. */
export type Order = Record<DocumentKind, string[]>;

export const KINDS: readonly DocumentKind[] = ["chapter", "fragment"];

export function orderOf(index: ProjectIndex): Order {
  return {
    chapter: index.chapters.map((entry) => entry.id),
    fragment: index.fragments.map((entry) => entry.id),
  };
}

/** The list that holds `id`: a document id, or the id of a list itself while it is empty. */
export function kindOf(order: Order, id: string): DocumentKind | undefined {
  if (id === "chapter" || id === "fragment") return id;
  return KINDS.find((kind) => order[kind].includes(id));
}

/**
 * Moves `id` next to `overId` (a document or an empty list). This is what the index shows while
 * the writer drags; the core is told only once the document is dropped.
 */
export function moveOver(order: Order, id: string, overId: string): Order {
  const from = kindOf(order, id);
  const to = kindOf(order, overId);
  if (!from || !to || id === overId) return order;

  if (from === to) {
    if (overId === to) return order;
    const list = order[from].filter((item) => item !== id);
    list.splice(order[from].indexOf(overId), 0, id);
    return { ...order, [from]: list };
  }

  const target = [...order[to]];
  const at = target.indexOf(overId);
  target.splice(at === -1 ? target.length : at, 0, id);
  return { ...order, [from]: order[from].filter((item) => item !== id), [to]: target };
}

/** Where `id` ended up, as the core's `document.move` expects it. */
export function placeOf(
  order: Order,
  id: string,
): { kind: DocumentKind; position: number } | undefined {
  const kind = kindOf(order, id);
  return kind ? { kind, position: order[kind].indexOf(id) } : undefined;
}

const NUMERALS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Chapters are numbered as in the old books: I, II, III… */
export function roman(value: number): string {
  let rest = value;
  let text = "";
  for (const [amount, numeral] of NUMERALS) {
    while (rest >= amount) {
      text += numeral;
      rest -= amount;
    }
  }
  return text;
}

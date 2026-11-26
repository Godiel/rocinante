import type { ElementSummary } from "../../bridge/generated/protocol";

/** Spanish order: «Ángela» goes with the A, «ñ» after «n», and «Juan 2» before «Juan 10». */
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** Lowercase and without accents, so «Quijano», «quijano» and «QUIJÁNO» are the same word to look for. */
export function folded(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

/** Every name an element goes by: its own and its aliases. */
export function namesOf(element: Pick<ElementSummary, "name" | "aliases">): string[] {
  return [element.name, ...element.aliases];
}

/** Whether any of its names contains the query, ignoring case and accents. An empty query matches all. */
export function matches(element: Pick<ElementSummary, "name" | "aliases">, query: string): boolean {
  const wanted = folded(query);
  return wanted === "" || namesOf(element).some((name) => folded(name).includes(wanted));
}

/** A copy sorted by name in Spanish order. */
export function byName<T extends Pick<ElementSummary, "name">>(elements: readonly T[]): T[] {
  return [...elements].sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * For each element that shares a name or an alias with another, the others that share it. Two characters
 * called Juan are allowed; the writer is only told.
 */
export function sharedNames(elements: readonly ElementSummary[]): Map<string, string[]> {
  const byFolded = new Map<string, Set<string>>();
  for (const element of elements) {
    for (const name of new Set(namesOf(element).map(folded))) {
      if (name === "") continue;
      const ids = byFolded.get(name) ?? new Set<string>();
      ids.add(element.id);
      byFolded.set(name, ids);
    }
  }

  const shared = new Map<string, string[]>();
  for (const ids of byFolded.values()) {
    if (ids.size < 2) continue;
    for (const id of ids) {
      const others = new Set(shared.get(id) ?? []);
      for (const other of ids) if (other !== id) others.add(other);
      shared.set(id, [...others]);
    }
  }
  return shared;
}

/** The key of the width of the button «Más» among those of the items. */
export const MORE = "bar-more";

/** Space between two items of the bar when it cannot be read from the page. */
export const BAR_GAP = 12;

interface Fits {
  id: string;
  priority: number | "bar" | "menu";
}

/**
 * Which items stay in the bar and which go to the menu «Más», given their widths and the room the bar has. The
 * items keep their order; when not all fit, the lowest priority goes first, and the menu takes room of its own.
 * Until the room is known, everything that may be in the bar is.
 */
export function fitting<T extends Fits>(
  items: readonly T[],
  widths: Readonly<Record<string, number>>,
  room: number | null,
  gap = BAR_GAP,
): { inBar: T[]; inMenu: T[] } {
  const always = items.filter((item) => item.priority === "menu");
  const candidates = items.filter((item) => item.priority !== "menu");
  if (room === null) return { inBar: candidates, inMenu: always };

  const width = (item: T) => (widths[item.id] ?? 0) + gap;
  const more = (widths[MORE] ?? 0) + gap;
  const total = (list: readonly T[]) => list.reduce((sum, item) => sum + width(item), 0);

  const leaving = new Set<T>();
  const staying = () => candidates.filter((item) => !leaving.has(item));
  const needsMenu = () => always.length > 0 || leaving.size > 0;
  const fits = () => total(staying()) + (needsMenu() ? more : 0) <= room;

  // The lowest priority leaves first; "bar" never leaves.
  const byPriority = [...candidates]
    .filter((item) => item.priority !== "bar")
    .sort((a, b) => (a.priority as number) - (b.priority as number));
  for (const item of byPriority) {
    if (fits()) break;
    leaving.add(item);
  }

  return {
    inBar: staying(),
    inMenu: [...candidates.filter((item) => leaving.has(item)), ...always],
  };
}

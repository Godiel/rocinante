import type { Milestone, Relationship, Threads } from "../../bridge/generated/protocol";

/** The most fichas the threads show at once, as the core allows. */
export const MAX_CHOSEN = 50;

/** The measures of the drawing of the threads, in pixels. */
export const LAYOUT = {
  /** The names of the fichas, on the left. */
  labels: 152,
  /** Each chapter. */
  column: 104,
  /** The titles of the chapters, on top. */
  header: 44,
  /** Each ficha. */
  row: 64,
  /** The smallest and the largest point. */
  minRadius: 4,
  maxRadius: 15,
} as const;

/** The radius of a point: it grows with the mentions, slower each time, up to a limit. */
export function radiusFor(mentions: number): number {
  return Math.min(LAYOUT.maxRadius, LAYOUT.minRadius + 2.2 * Math.sqrt(Math.max(0, mentions - 1)));
}

export function columnX(place: number): number {
  return LAYOUT.labels + LAYOUT.column * place + LAYOUT.column / 2;
}

export function rowY(place: number): number {
  return LAYOUT.header + LAYOUT.row * place + LAYOUT.row / 2;
}

export function drawingSize(chapters: number, rows: number): { width: number; height: number } {
  return {
    width: LAYOUT.labels + LAYOUT.column * Math.max(1, chapters),
    height: LAYOUT.header + LAYOUT.row * Math.max(1, rows),
  };
}

/** The place of each chapter in reading order. */
export function chapterPlaces(threads: Pick<Threads, "chapters">): Map<string, number> {
  return new Map(threads.chapters.map((chapter, place) => [chapter.documentId, place]));
}

/**
 * Whether a relationship holds in the chapter at `place`: between its first and its last chapter, both included.
 * A limit whose chapter is no longer in the work does not count, as in the core.
 */
export function holdsAt(
  relationship: Pick<Relationship, "starts" | "ends">,
  place: number,
  places: ReadonlyMap<string, number>,
): boolean {
  const first = relationship.starts === null ? undefined : places.get(relationship.starts);
  const last = relationship.ends === null ? undefined : places.get(relationship.ends);
  return (first === undefined || first <= place) && (last === undefined || place <= last);
}

/** Where a relationship starts or ends on the threads: only the limits that are chapters of the work. */
export function limitsOf(
  relationship: Pick<Relationship, "starts" | "ends">,
  places: ReadonlyMap<string, number>,
): { starts: number | null; ends: number | null } {
  return {
    starts: relationship.starts === null ? null : (places.get(relationship.starts) ?? null),
    ends: relationship.ends === null ? null : (places.get(relationship.ends) ?? null),
  };
}

/** The milestones of each ficha in each chapter, in the order of the text. */
export function milestonesByPlace(milestones: readonly Milestone[]): Map<string, Milestone[]> {
  const by = new Map<string, Milestone[]>();
  for (const milestone of milestones) {
    const key = `${milestone.elementId}:${milestone.documentId}`;
    by.set(key, [...(by.get(key) ?? []), milestone]);
  }
  return by;
}

/** A short sentence cut to fit under its point. */
export function shortened(text: string, length = 16): string {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

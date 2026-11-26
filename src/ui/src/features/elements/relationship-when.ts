import type { Relationship } from "../../bridge/generated/protocol";
import type { ChapterEntry } from "./useChapters";

/** When a relationship holds, in a few words: «del 1 al 7», «desde el 8», «hasta el 3»; empty for the whole work. */
export function whenText(
  relationship: Pick<Relationship, "starts" | "ends">,
  chapters: readonly ChapterEntry[],
): string {
  const number = (id: string | null) => {
    if (id === null) return null;
    const place = chapters.findIndex((chapter) => chapter.id === id);
    return place < 0 ? null : place + 1;
  };
  const first = number(relationship.starts);
  const last = number(relationship.ends);
  if (first !== null && last !== null)
    return first === last ? `en el capítulo ${first}` : `del capítulo ${first} al ${last}`;
  if (first !== null) return `desde el capítulo ${first}`;
  if (last !== null) return `hasta el capítulo ${last}`;
  return "";
}

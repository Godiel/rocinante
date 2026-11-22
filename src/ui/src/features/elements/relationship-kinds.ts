import type { Relationship, RelationshipKind } from "../../bridge/generated/protocol";

/** A kind of relationship as the writer reads it: forward from `from`, inverse from `to`; null inverse is symmetric. */
export interface KindWords {
  id: string;
  forward: string;
  inverse: string | null;
}

/**
 * The common kinds, offered to every work. Their words live here so they can be translated; the work only
 * keeps their id. An id that is no longer here reads as {@link UNKNOWN}.
 */
export const COMMON_KINDS: readonly KindWords[] = [
  { id: "builtin:child-of", forward: "hijo de", inverse: "padre de" },
  { id: "builtin:sibling-of", forward: "hermano de", inverse: null },
  { id: "builtin:partner-of", forward: "pareja de", inverse: null },
  { id: "builtin:friend-of", forward: "amigo de", inverse: null },
  { id: "builtin:enemy-of", forward: "enemigo de", inverse: null },
  { id: "builtin:servant-of", forward: "criado de", inverse: "amo de" },
  { id: "builtin:lives-in", forward: "vive en", inverse: "lugar donde vive" },
  { id: "builtin:born-in", forward: "nació en", inverse: "lugar donde nació" },
  { id: "builtin:belongs-to", forward: "pertenece a", inverse: "dueño de" },
  { id: "builtin:located-in", forward: "está en", inverse: "contiene" },
  { id: "builtin:takes-part-in", forward: "participa en", inverse: "incluye a" },
];

const UNKNOWN: KindWords = { id: "", forward: "relacionado con", inverse: null };

/** The words of a kind: a common one or one the writer wrote in this work. */
export function wordsOf(kind: string, ownKinds: readonly RelationshipKind[]): KindWords {
  return (
    COMMON_KINDS.find((common) => common.id === kind) ??
    ownKinds.find((own) => own.id === kind) ?? { ...UNKNOWN, id: kind }
  );
}

export function isSymmetric(kind: string, ownKinds: readonly RelationshipKind[]): boolean {
  return wordsOf(kind, ownKinds).inverse === null;
}

/** How a relationship reads from one of its elements: «hijo de» from Claudio, «padre de» from Antonio. */
export function labelFrom(
  relationship: Relationship,
  elementId: string,
  ownKinds: readonly RelationshipKind[],
): string {
  const words = wordsOf(relationship.kind, ownKinds);
  return relationship.from === elementId || words.inverse === null ? words.forward : words.inverse;
}

/**
 * Whether joining `from` and `to` with `kind` repeats a relationship there is: the same both ways round for a
 * symmetric kind. The core checks its own kinds; the common ones only the UI knows to be symmetric.
 */
export function repeats(
  relationships: readonly Relationship[],
  from: string,
  to: string,
  kind: string,
  ownKinds: readonly RelationshipKind[],
  except?: string,
): boolean {
  const symmetric = isSymmetric(kind, ownKinds);
  return relationships.some(
    (relationship) =>
      relationship.id !== except &&
      relationship.kind === kind &&
      ((relationship.from === from && relationship.to === to) ||
        (symmetric && relationship.from === to && relationship.to === from)),
  );
}

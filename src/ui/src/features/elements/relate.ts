import { request } from "../../bridge/core";
import type {
  NewRelationshipKind,
  Relationship,
  RelationshipKind,
} from "../../bridge/generated/protocol";
import { COMMON_KINDS, repeats } from "./relationship-kinds";

/**
 * What the writer picks to join two fichas, read from the first to the second: a kind there is, maybe read the
 * other way round («padre de» is «hijo de» with the fichas swapped), or a pair of their own.
 */
export type KindChoice = { kind: string; swap: boolean } | { newKind: NewRelationshipKind };

/** One line of the picker: how the relationship reads from the first ficha. */
export interface KindOption {
  kind: string;
  swap: boolean;
  label: string;
  own: boolean;
}

/** Every way to read a relationship from the first ficha: forward, and backward for the kinds with an inverse. */
export function kindOptions(ownKinds: readonly RelationshipKind[]): KindOption[] {
  const options: KindOption[] = [];
  for (const [list, own] of [
    [COMMON_KINDS, false],
    [ownKinds, true],
  ] as const) {
    for (const words of list) {
      options.push({ kind: words.id, swap: false, label: words.forward, own });
      if (words.inverse !== null)
        options.push({ kind: words.id, swap: true, label: words.inverse, own });
    }
  }
  return options;
}

/** Whether an option would repeat a relationship the two fichas have. */
export function optionRepeats(
  option: KindOption,
  from: string,
  to: string,
  relationships: readonly Relationship[],
  ownKinds: readonly RelationshipKind[],
  except?: string,
): boolean {
  const [a, b] = option.swap ? [to, from] : [from, to];
  return repeats(relationships, a, b, option.kind, ownKinds, except);
}

/** A pair the writer typed: without spaces around, and symmetric when the other side is empty or the same. */
export function newKindOf(forward: string, inverse: string): NewRelationshipKind {
  const ahead = forward.trim();
  const back = inverse.trim();
  return { forward: ahead, inverse: back === "" || back === ahead ? null : back };
}

/** Joins `from` and `to` as the writer chose. */
export function relate(from: string, to: string, choice: KindChoice, origin: string) {
  if ("newKind" in choice)
    return request("relationship.create", { from, to, newKind: choice.newKind, origin });
  const [a, b] = choice.swap ? [to, from] : [from, to];
  return request("relationship.create", { from: a, to: b, kind: choice.kind, origin });
}

/**
 * Gives a relationship another kind. Read the other way round it is a new relationship: the new one is made
 * first, so a failure leaves the old one where it was.
 */
export async function changeRelationship(
  relationship: Relationship,
  choice: KindChoice,
  origin: string,
) {
  if ("newKind" in choice)
    return request("relationship.update", {
      id: relationship.id,
      newKind: choice.newKind,
      origin,
    });
  if (!choice.swap)
    return request("relationship.update", { id: relationship.id, kind: choice.kind, origin });
  const created = await request("relationship.create", {
    from: relationship.to,
    to: relationship.from,
    kind: choice.kind,
    origin,
  });
  await request("relationship.delete", { id: relationship.id, origin });
  return created;
}

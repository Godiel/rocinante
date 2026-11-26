import type { Board, CoreNotifications } from "../../bridge/generated/protocol";

export type ElementsChange = CoreNotifications["elements.changed"];

export const EMPTY_BOARD: Board = { elements: [], relationships: [], ownKinds: [], trash: [] };

function upsert<T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] {
  // Nothing changed: the same list, so what depends on it need not be redone.
  if (items.length === 0) return list as T[];
  const byId = new Map(items.map((item) => [item.id, item]));
  const kept = list.map((item) => byId.get(item.id) ?? item);
  const known = new Set(list.map((item) => item.id));
  return [...kept, ...items.filter((item) => !known.has(item.id))];
}

function without<T extends { id: string }>(list: readonly T[], ids: Iterable<string>): T[] {
  const gone = new Set(ids);
  if (gone.size === 0) return list as T[];
  const kept = list.filter((item) => !gone.has(item.id));
  return kept.length === list.length ? (list as T[]) : kept;
}

/**
 * The board after a change announced by the core. Each list of the change has only what changed: elements
 * are now in the work, trash went to the trash, and so on. Applying the same change twice changes nothing.
 */
export function applyChange(board: Board, change: ElementsChange): Board {
  const toWork = change.elements.map((element) => element.id);
  const toTrash = change.trash.map((element) => element.id);
  return {
    elements: upsert(without(board.elements, toTrash), change.elements),
    trash: upsert(without(board.trash, toWork), change.trash),
    relationships: upsert(
      without(board.relationships, change.removedRelationships),
      change.relationships,
    ),
    ownKinds: upsert(board.ownKinds, change.ownKinds),
  };
}

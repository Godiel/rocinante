import { useMemo, useState } from "react";
import { request } from "../../bridge/core";
import type { Board, ElementSummary, Relationship } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { kindLabel } from "./kinds";
import { changeRelationship, relate, type KindChoice } from "./relate";
import { labelFrom } from "./relationship-kinds";
import { RelationshipPicker } from "./RelationshipPicker";
import { byName, matches } from "./search";

export interface ElementRelationsProps {
  elementId: string;
  board: Board;
  origin: string;
  /** Opens the other ficha of a relationship. */
  onOpen(id: string): void;
  onProblem(message: string | null): void;
}

/** What the picker is open for: a new relationship with another ficha, or one there is. */
type Picking =
  { kind: "new"; other: ElementSummary } | { kind: "change"; relationship: Relationship };

/**
 * The relationships of a ficha, each read from its side («padre de Claudio»), with a jump to the other ficha;
 * and a way to relate it to another, found by name.
 */
export function ElementRelations({
  elementId,
  board,
  origin,
  onOpen,
  onProblem,
}: ElementRelationsProps) {
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<Picking | null>(null);

  const byId = useMemo(
    () => new Map(board.elements.map((element) => [element.id, element])),
    [board.elements],
  );
  const self = byId.get(elementId);

  const rows = useMemo(() => {
    const list = board.relationships
      .filter((relationship) => relationship.from === elementId || relationship.to === elementId)
      .map((relationship) => {
        const otherId = relationship.from === elementId ? relationship.to : relationship.from;
        return {
          relationship,
          label: labelFrom(relationship, elementId, board.ownKinds),
          other: byId.get(otherId),
        };
      })
      .filter((row): row is typeof row & { other: ElementSummary } => row.other !== undefined);
    const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
    return list.sort(
      (a, b) => collator.compare(a.label, b.label) || collator.compare(a.other.name, b.other.name),
    );
  }, [board.relationships, board.ownKinds, byId, elementId]);

  const candidates = useMemo(
    () =>
      byName(
        board.elements.filter((element) => element.id !== elementId && matches(element, query)),
      ).slice(0, 8),
    [board.elements, elementId, query],
  );

  if (!self) return null;

  async function done(choice: KindChoice) {
    const now = picking;
    if (!now) return;
    setPicking(null);
    try {
      if (now.kind === "new") await relate(elementId, now.other.id, choice, origin);
      else await changeRelationship(now.relationship, choice, origin);
      onProblem(null);
    } catch (error) {
      onProblem(messageFor(error));
    }
  }

  function remove(relationship: Relationship) {
    setPicking(null);
    request("relationship.delete", { id: relationship.id, origin }).then(
      () => onProblem(null),
      (error: unknown) => onProblem(messageFor(error)),
    );
  }

  // The picker reads from the side the relationship has: from this ficha for a new one.
  const pickerSides =
    picking?.kind === "new"
      ? { from: self, to: picking.other }
      : picking
        ? { from: byId.get(picking.relationship.from), to: byId.get(picking.relationship.to) }
        : null;

  return (
    <section className="element-section element-relations">
      <h3 className="element-label">Relaciones</h3>
      {rows.length === 0 && !finding && <p className="element-quiet">Aún no tiene relaciones.</p>}
      {rows.length > 0 && (
        <ul className="element-relations-list">
          {rows.map(({ relationship, label, other }) => (
            <li key={relationship.id} className="element-relation">
              <span className="element-relation-label">{label}</span>{" "}
              <button
                type="button"
                className="element-relation-other"
                title={`Abrir la ficha de ${other.name}`}
                onClick={() => onOpen(other.id)}
              >
                {other.name}
              </button>
              <button
                type="button"
                className="element-relation-change"
                aria-label={`Cambiar «${label} ${other.name}»`}
                title="Cambiar la relación"
                onClick={() => setPicking({ kind: "change", relationship })}
              >
                ✎
              </button>
              <button
                type="button"
                className="element-relation-remove"
                aria-label={`Quitar «${label} ${other.name}»`}
                title="Quitar la relación"
                onClick={() => remove(relationship)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {finding ? (
        <div className="element-relate">
          <label>
            <span className="visually-hidden">Buscar la otra ficha</span>
            <input
              type="search"
              autoFocus
              value={query}
              placeholder="¿Con quién o con qué?"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setFinding(false);
                  setQuery("");
                } else if (event.key === "Enter" && candidates[0]) {
                  event.preventDefault();
                  setPicking({ kind: "new", other: candidates[0] });
                }
              }}
            />
          </label>
          <ul className="element-relate-candidates">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onClick={() => setPicking({ kind: "new", other: candidate })}>
                  {candidate.name}{" "}
                  <span className="element-quiet small-caps">{kindLabel(candidate)}</span>
                </button>
              </li>
            ))}
          </ul>
          {candidates.length === 0 && (
            <p className="element-quiet" role="status">
              {board.elements.length > 1
                ? "Ninguna ficha se llama así."
                : "No hay otras fichas con las que relacionarla."}
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="action element-add" onClick={() => setFinding(true)}>
          Relacionar con…
        </button>
      )}

      {picking && pickerSides?.from && pickerSides.to && (
        <RelationshipPicker
          from={pickerSides.from}
          to={pickerSides.to}
          relationships={board.relationships}
          ownKinds={board.ownKinds}
          changing={picking.kind === "change" ? picking.relationship : undefined}
          onChoose={(choice) => {
            setFinding(false);
            setQuery("");
            void done(choice);
          }}
          onCancel={() => setPicking(null)}
          onRemove={picking.kind === "change" ? () => remove(picking.relationship) : undefined}
        />
      )}
    </section>
  );
}

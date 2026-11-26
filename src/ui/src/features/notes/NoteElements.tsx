import { useMemo, useState } from "react";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { kindLabel } from "../elements/kinds";
import { byName, matches } from "../elements/search";

const SHOWN = 8;

export interface NoteElementsProps {
  /** The fichas the note is linked with, in order; some may be in the trash. */
  linked: readonly string[];
  /** The fichas in the work. */
  elements: readonly ElementSummary[];
  onChange(linked: string[]): void;
  onOpenElement(id: string): void;
}

/** The fichas a note is about: each one opens, each one comes off, and more are found by name or alias. */
export function NoteElements({ linked, elements, onChange, onOpenElement }: NoteElementsProps) {
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);
  // A ficha in the trash keeps its link, unseen, until it comes back.
  const shown = linked.flatMap((id) => byId.get(id) ?? []);
  const candidates = useMemo(
    () =>
      byName(
        elements.filter((element) => !linked.includes(element.id) && matches(element, query)),
      ).slice(0, SHOWN),
    [elements, linked, query],
  );

  function link(id: string) {
    onChange([...linked, id]);
    setQuery("");
    setFinding(false);
  }

  return (
    <section className="element-section note-elements">
      <h3 className="element-label">Fichas</h3>
      {shown.length === 0 && !finding && (
        <p className="element-quiet">No está enlazada con ninguna ficha.</p>
      )}
      {shown.length > 0 && (
        <ul className="note-elements-list">
          {shown.map((element) => (
            <li key={element.id} className="note-element">
              <button
                type="button"
                className="element-relation-other"
                title={`Abrir la ficha de ${element.name}`}
                onClick={() => onOpenElement(element.id)}
              >
                {element.name}
              </button>
              <button
                type="button"
                className="element-relation-remove"
                aria-label={`Quitar «${element.name}»`}
                title="Quitar el enlace"
                onClick={() => onChange(linked.filter((id) => id !== element.id))}
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
            <span className="visually-hidden">Buscar una ficha para enlazar</span>
            <input
              type="search"
              autoFocus
              value={query}
              placeholder="¿Quién o qué?"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setFinding(false);
                  setQuery("");
                } else if (event.key === "Enter" && candidates[0]) {
                  event.preventDefault();
                  link(candidates[0].id);
                }
              }}
            />
          </label>
          <ul className="element-relate-candidates">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button type="button" onClick={() => link(candidate.id)}>
                  {candidate.name}{" "}
                  <span className="element-quiet small-caps">{kindLabel(candidate)}</span>
                </button>
              </li>
            ))}
          </ul>
          {candidates.length === 0 && (
            <p className="element-quiet" role="status">
              {elements.length > linked.length
                ? "Ninguna ficha se llama así."
                : "No hay más fichas."}
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="action element-add" onClick={() => setFinding(true)}>
          Enlazar con una ficha…
        </button>
      )}
    </section>
  );
}

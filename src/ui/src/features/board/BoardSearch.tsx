import { useId, useMemo, useState } from "react";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { kindLabel } from "../elements/kinds";
import { byName, matches } from "../elements/search";

const SHOWN = 6;

interface BoardSearchProps {
  elements: readonly ElementSummary[];
  /** Takes the view to a card. */
  onFind(id: string): void;
}

/** Finds a card by name or alias and takes the board to it. */
export function BoardSearch({ elements, onFind }: BoardSearchProps) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const found = useMemo(
    () =>
      query.trim() === "" ? [] : byName(elements.filter((element) => matches(element, query))),
    [elements, query],
  );

  function find(id: string) {
    setQuery("");
    onFind(id);
  }

  return (
    <div className="board-search">
      <label>
        <span className="visually-hidden">Buscar una tarjeta</span>
        <input
          type="search"
          value={query}
          placeholder="Buscar una tarjeta"
          aria-controls={`${ids}-found`}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && found[0]) {
              event.preventDefault();
              find(found[0].id);
            } else if (event.key === "Escape" && query !== "") {
              event.preventDefault();
              setQuery("");
            }
          }}
        />
      </label>
      {query.trim() !== "" && (
        <ul id={`${ids}-found`} className="board-search-found">
          {found.slice(0, SHOWN).map((element) => (
            <li key={element.id}>
              <button type="button" onClick={() => find(element.id)}>
                {element.name}{" "}
                <span className="board-search-kind small-caps">{kindLabel(element)}</span>
              </button>
            </li>
          ))}
          {found.length === 0 && (
            <li className="board-search-none" role="status">
              Ninguna tarjeta se llama así.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

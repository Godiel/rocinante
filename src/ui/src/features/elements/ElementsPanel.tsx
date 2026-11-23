import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, ElementKind, ElementSummary } from "../../bridge/generated/protocol";
import { ElementSheet } from "./ElementSheet";
import { useElementImage } from "./images";
import { KIND_NAMES, KINDS, kindLabel } from "./kinds";
import { byName, matches, sharedNames } from "./search";
import { useElement } from "./useBoard";
import "./elements.css";

export interface ElementsPanelProps {
  board: Board;
  loaded: boolean;
  /** The ficha shown in place of the list, if any. */
  openId: string | null;
  /** A ficha just created, and the field the writer goes to first in it. */
  fresh: { id: string; field: "name" | "kind" } | null;
  origin: string;
  /** Changes each time the writer opens the panel, to take the keyboard to the search. */
  searchRequest: number;
  chooseImage(): Promise<string | null>;
  onOpen(id: string | null): void;
  onCreate(): void;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The fichas of the work beside the text: a search, the list grouped by kind and, when the writer picks one,
 * the ficha itself in its place.
 */
export function ElementsPanel({
  board,
  loaded,
  openId,
  fresh,
  origin,
  searchRequest,
  chooseImage,
  onOpen,
  onCreate,
  onClose,
  onProblem,
}: ElementsPanelProps) {
  // A ficha that went to the trash, here or in another window, gives its place back to the list.
  const shownId = openId && board.elements.some((element) => element.id === openId) ? openId : null;
  // Coming back from a ficha takes the keyboard to the search; opening the panel is the view's to decide.
  const [cameBack, setCameBack] = useState(false);
  const back = () => {
    setCameBack(true);
    onOpen(null);
  };

  return (
    <aside
      className="sheet elements-panel"
      aria-label="Fichas de la obra"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        if ((event.target as HTMLElement).closest("[data-own-keys]")) return;
        event.preventDefault();
        if (shownId) back();
        else onClose();
      }}
    >
      <header className="sheet-header small-caps">
        {shownId ? (
          <button
            type="button"
            className="action elements-back"
            onClick={back}
            title="Volver a la lista (Esc)"
          >
            ← Fichas
          </button>
        ) : (
          <h2 className="sheet-title">Fichas</h2>
        )}
        <button type="button" className="action" onClick={onClose} title="Cerrar (Ctrl+Mayús+E)">
          Cerrar
        </button>
      </header>

      {shownId ? (
        <OpenSheet
          id={shownId}
          field={fresh?.id === shownId ? fresh.field : null}
          others={board.elements}
          origin={origin}
          chooseImage={chooseImage}
          onOpen={onOpen}
          onProblem={onProblem}
        />
      ) : (
        <ElementList
          elements={board.elements}
          loaded={loaded}
          takesFocus={cameBack}
          searchRequest={searchRequest}
          onOpen={(id) => {
            setCameBack(false);
            onOpen(id);
          }}
          onCreate={onCreate}
        />
      )}
    </aside>
  );
}

interface OpenSheetProps {
  id: string;
  field: "name" | "kind" | null;
  others: readonly ElementSummary[];
  origin: string;
  chooseImage(): Promise<string | null>;
  onOpen(id: string): void;
  onProblem(message: string | null): void;
}

function OpenSheet({ id, field, ...props }: OpenSheetProps) {
  const element = useElement(id);
  const frame = useRef<HTMLDivElement>(null);
  const ready = element !== null;

  // A new ficha starts at its name, or at its kind when the name came from the text.
  useEffect(() => {
    if (!ready || !field) return;
    const target = frame.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      field === "name" ? ".element-name" : ".element-kind select",
    );
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [ready, field]);

  return (
    <div ref={frame}>
      {element ? (
        <ElementSheet key={id} element={element} {...props} />
      ) : (
        <p className="elements-empty">Abriendo la ficha…</p>
      )}
    </div>
  );
}

interface ElementListProps {
  elements: readonly ElementSummary[];
  loaded: boolean;
  takesFocus: boolean;
  searchRequest: number;
  onOpen(id: string): void;
  onCreate(): void;
}

function ElementList({
  elements,
  loaded,
  takesFocus,
  searchRequest,
  onOpen,
  onCreate,
}: ElementListProps) {
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState<ReadonlySet<ElementKind>>(() => new Set());
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (takesFocus || searchRequest > 0) search.current?.focus();
  }, [takesFocus, searchRequest]);

  const searching = query.trim() !== "";
  const groups = useMemo(
    () =>
      KINDS.map((kind) => ({
        kind,
        elements: byName(
          elements.filter((element) => element.kind === kind && matches(element, query)),
        ),
      })).filter((group) => group.elements.length > 0),
    [elements, query],
  );
  const shared = useMemo(() => sharedNames(elements), [elements]);

  function toggle(kind: ElementKind) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  return (
    <div className="elements-list">
      <div className="elements-tools">
        <label className="elements-search">
          <span className="visually-hidden">Buscar una ficha</span>
          <input
            ref={search}
            type="search"
            value={query}
            placeholder="Buscar por nombre o alias"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
        </label>
        <button type="button" className="action action-main" onClick={onCreate}>
          Nueva ficha
        </button>
      </div>

      {loaded && elements.length === 0 && (
        <p className="elements-empty">
          Aún no hay fichas. Crea una aquí o selecciona un nombre en el texto y elige «Crear ficha».
        </p>
      )}
      {loaded && elements.length > 0 && groups.length === 0 && (
        <p className="elements-empty" role="status">
          Ninguna ficha se llama así.
        </p>
      )}

      {groups.map((group) => {
        // While searching, every group with a match shows: a folded group would hide what was found.
        const open = searching || !folded.has(group.kind);
        const listId = `elements-group-${group.kind}`;
        return (
          <section key={group.kind} className="elements-group">
            <h3 className="elements-group-title small-caps">
              <button
                type="button"
                className="elements-group-toggle"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => toggle(group.kind)}
              >
                {KIND_NAMES[group.kind].group} ({group.elements.length})
              </button>
            </h3>
            <ul id={listId} hidden={!open} className="elements-items">
              {group.elements.map((element) => (
                <li key={element.id}>
                  <ElementItem
                    element={element}
                    repeated={shared.has(element.id)}
                    onOpen={() => onOpen(element.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ElementItem({
  element,
  repeated,
  onOpen,
}: {
  element: ElementSummary;
  repeated: boolean;
  onOpen(): void;
}) {
  const thumbnail = useElementImage(element.id, element.image, "thumbnail");
  return (
    <button type="button" className="elements-item" onClick={onOpen}>
      {thumbnail ? (
        <img className="elements-thumbnail" src={thumbnail} alt="" />
      ) : (
        <span className="elements-thumbnail elements-thumbnail-empty" aria-hidden="true">
          {element.name.slice(0, 1)}
        </span>
      )}
      <span className="elements-item-text">
        <span className="elements-item-name">{element.name}</span>
        {(element.kind === "other" || element.aliases.length > 0) && (
          <span className="elements-item-detail">
            {[element.kind === "other" ? kindLabel(element) : null, ...element.aliases]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
      {repeated && (
        <span className="elements-repeated" title="Otra ficha tiene el mismo nombre o alias">
          <span aria-hidden="true">≈</span>
          <span className="visually-hidden">(nombre repetido)</span>
        </span>
      )}
    </button>
  );
}

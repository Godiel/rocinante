import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Board, ElementKind, ElementSummary } from "../../bridge/generated/protocol";
import { useElementImage } from "./images";
import { KIND_NAMES, KINDS, kindLabel } from "./kinds";
import { byName, matches, sharedNames } from "./search";
import { OpenElementSheet, type OpenElementSheetProps } from "./OpenElementSheet";
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
  onTrash(id: string, name: string): void;
  onRestore(id: string): void;
  /** The tabs of the panel, shown in place of its title. */
  tabs?: ReactNode;
  /** The notes of the work, so each ficha shows those about it. */
  notes?: OpenElementSheetProps["notes"];
  /** The text of the work, so each ficha shows where it is mentioned. */
  mentions?: OpenElementSheetProps["mentions"];
  /** Whether the mentions are marked in the text, and the way to change it. */
  mentionsVisible?: boolean;
  onMentionsVisible?(visible: boolean): void;
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
  onTrash,
  onRestore,
  tabs,
  notes,
  mentions,
  mentionsVisible,
  onMentionsVisible,
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
          (tabs ?? <h2 className="sheet-title">Fichas</h2>)
        )}
        <button type="button" className="action" onClick={onClose} title="Cerrar (Ctrl+Mayús+E)">
          Cerrar
        </button>
      </header>

      {shownId ? (
        <OpenElementSheet
          id={shownId}
          field={fresh?.id === shownId ? fresh.field : null}
          board={board}
          origin={origin}
          chooseImage={chooseImage}
          onOpen={onOpen}
          onProblem={onProblem}
          onTrash={onTrash}
          notes={notes}
          mentions={mentions}
        />
      ) : (
        <ElementList
          elements={board.elements}
          trash={board.trash}
          loaded={loaded}
          takesFocus={cameBack}
          searchRequest={searchRequest}
          onOpen={(id) => {
            setCameBack(false);
            onOpen(id);
          }}
          onCreate={onCreate}
          onRestore={onRestore}
          mentionsVisible={mentionsVisible}
          onMentionsVisible={onMentionsVisible}
        />
      )}
    </aside>
  );
}

interface ElementListProps {
  mentionsVisible?: boolean;
  onMentionsVisible?(visible: boolean): void;
  elements: readonly ElementSummary[];
  trash: readonly ElementSummary[];
  loaded: boolean;
  takesFocus: boolean;
  searchRequest: number;
  onOpen(id: string): void;
  onCreate(): void;
  onRestore(id: string): void;
}

function ElementList({
  elements,
  trash,
  loaded,
  takesFocus,
  searchRequest,
  onOpen,
  onCreate,
  onRestore,
  mentionsVisible,
  onMentionsVisible,
}: ElementListProps) {
  const [query, setQuery] = useState("");
  // The box answers the click at once; the preference comes back from the core a moment later.
  const stored = mentionsVisible ?? true;
  const [marking, setMarking] = useState({ stored, shown: stored });
  if (marking.stored !== stored) setMarking({ stored, shown: stored });
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

      {onMentionsVisible && (
        <label className="elements-mentions-toggle">
          <input
            type="checkbox"
            checked={marking.shown}
            onChange={(event) => {
              setMarking({ stored, shown: event.target.checked });
              onMentionsVisible(event.target.checked);
            }}
          />{" "}
          Marcar menciones en el texto
        </label>
      )}

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

      {trash.length > 0 && (
        <details className="elements-trash">
          <summary className="elements-group-title small-caps">Papelera ({trash.length})</summary>
          <ul className="elements-items">
            {byName(trash).map((element) => (
              <li key={element.id} className="elements-trash-entry">
                <span className="elements-trash-name">{element.name}</span>
                <button
                  type="button"
                  className="action"
                  aria-label={`Restaurar «${element.name}»`}
                  onClick={() => onRestore(element.id)}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
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

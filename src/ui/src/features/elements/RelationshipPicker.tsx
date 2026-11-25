import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Relationship, RelationshipKind } from "../../bridge/generated/protocol";
import { kindOptions, newKindOf, optionRepeats, type KindChoice, type KindOption } from "./relate";
import { folded } from "./search";

export interface RelationshipPickerProps {
  from: { id: string; name: string };
  to: { id: string; name: string };
  relationships: readonly Relationship[];
  ownKinds: readonly RelationshipKind[];
  /** The relationship being changed, if it is one there is: its kind shows as chosen. */
  changing?: Relationship;
  onChoose(choice: KindChoice): void;
  onCancel(): void;
  /** Takes the relationship away; only for one there is. */
  onRemove?(): void;
}

const LABEL_LIMIT = 60;

/**
 * How two fichas relate, read from the first: «Claudio — hijo de — Antonio». The common kinds and those of the
 * work, a search among them, and «Nueva…» for a pair of the writer's own.
 */
export function RelationshipPicker({
  from,
  to,
  relationships,
  ownKinds,
  changing,
  onChoose,
  onCancel,
  onRemove,
}: RelationshipPickerProps) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const [writing, setWriting] = useState(false);
  const [forward, setForward] = useState("");
  const [inverse, setInverse] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const forwardField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (writing ? forwardField : search).current?.focus();
  }, [writing]);

  const options = useMemo(() => {
    const wanted = folded(query);
    return kindOptions(ownKinds).filter(
      (option) => wanted === "" || folded(option.label).includes(wanted),
    );
  }, [ownKinds, query]);

  const isCurrent = (option: KindOption) =>
    changing !== undefined && option.kind === changing.kind && !option.swap;
  const isRepeated = (option: KindOption) =>
    !isCurrent(option) &&
    optionRepeats(option, from.id, to.id, relationships, ownKinds, changing?.id);

  const common = options.filter((option) => !option.own);
  const own = options.filter((option) => option.own);
  const firstFree = options.find((option) => !isRepeated(option) && !isCurrent(option));

  function choose(option: KindOption) {
    if (isCurrent(option)) onCancel();
    else onChoose({ kind: option.kind, swap: option.swap });
  }

  const written = newKindOf(forward, inverse);

  function list(title: string, group: KindOption[]) {
    if (group.length === 0) return null;
    return (
      <section className="relation-group">
        <h3 className="relation-group-title small-caps">{title}</h3>
        <ul className="relation-options">
          {group.map((option) => {
            const repeated = isRepeated(option);
            const current = isCurrent(option);
            return (
              <li key={`${option.kind}:${option.swap}`}>
                <button
                  type="button"
                  className={`relation-option${current ? " relation-option-current" : ""}`}
                  disabled={repeated}
                  aria-pressed={changing ? current : undefined}
                  title={repeated ? "Ya tienen esa relación" : undefined}
                  onClick={() => choose(option)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  // Over everything, whichever panel asked for it.
  return createPortal(
    <div
      className="relation-backdrop"
      onMouseDown={(event) => {
        // A click outside leaves things as they were.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="relation-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        data-own-keys=""
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          if (writing) setWriting(false);
          else onCancel();
        }}
      >
        <h2 id={`${ids}-title`} className="relation-picker-title">
          <span className="relation-picker-name">{from.name}</span>{" "}
          <span className="relation-picker-gap small-caps">es…</span>{" "}
          <span className="relation-picker-name">{to.name}</span>
        </h2>

        {writing ? (
          <form
            className="relation-new"
            onSubmit={(event) => {
              event.preventDefault();
              if (written.forward !== "") onChoose({ newKind: written });
            }}
          >
            <label className="relation-new-field">
              <span className="element-label">
                Cómo se lee: {from.name} … {to.name}
              </span>
              <input
                ref={forwardField}
                value={forward}
                maxLength={LABEL_LIMIT}
                placeholder="maestro de"
                onChange={(event) => setForward(event.target.value)}
              />
            </label>
            <label className="relation-new-field">
              <span className="element-label">
                Y al revés: {to.name} … {from.name}
              </span>
              <input
                value={inverse}
                maxLength={LABEL_LIMIT}
                placeholder="discípulo de"
                aria-describedby={`${ids}-inverse`}
                onChange={(event) => setInverse(event.target.value)}
              />
            </label>
            <p id={`${ids}-inverse`} className="relation-hint">
              Déjalo vacío si se lee igual desde las dos, como «hermano de».
            </p>
            <div className="relation-actions">
              <button
                type="submit"
                className="action action-main"
                disabled={written.forward === ""}
              >
                Relacionar
              </button>
              <button type="button" className="action" onClick={() => setWriting(false)}>
                Volver
              </button>
            </div>
          </form>
        ) : (
          <>
            <label className="relation-search">
              <span className="visually-hidden">Buscar una relación</span>
              <input
                ref={search}
                type="search"
                value={query}
                placeholder="Buscar: hijo, vive, amigo…"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && firstFree) {
                    event.preventDefault();
                    choose(firstFree);
                  }
                }}
              />
            </label>
            <div className="relation-lists">
              {list("De esta obra", own)}
              {list("Comunes", common)}
              {options.length === 0 && (
                <p className="relation-hint" role="status">
                  Ninguna se llama así. Escríbela con «Nueva…».
                </p>
              )}
            </div>
            <div className="relation-actions">
              <button
                type="button"
                className="action"
                onClick={() => {
                  setForward(query.trim());
                  setWriting(true);
                }}
              >
                Nueva…
              </button>
              {onRemove && (
                <button type="button" className="action relation-remove" onClick={onRemove}>
                  Quitar la relación
                </button>
              )}
              <button type="button" className="action" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    window.document.body,
  );
}

import { useId, useState } from "react";
import { request } from "../../bridge/core";
import type { ElementKind, Proposal, ProposalChanges } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { KINDS, KIND_NAMES, kindLabel } from "../elements/kinds";

export interface ProposalListProps {
  proposals: readonly Proposal[];
  /** Whether the squire reads this work: if not, the writer is told where to turn it on. */
  enabled: boolean;
  origin: string;
  onGoToPassage(proposal: Proposal): void;
  onProblem(message: string | null): void;
}

const PASSAGE_LENGTH = 180;

function shortened(passage: string): string {
  return passage.length > PASSAGE_LENGTH
    ? `${passage.slice(0, PASSAGE_LENGTH).trimEnd()}…`
    : passage;
}

/** What a proposal says, in a line. */
function Said({ proposal }: { proposal: Proposal }) {
  if (proposal.element) {
    return (
      <>
        Ficha nueva: <strong>{proposal.element.name}</strong> · {kindLabel(proposal.element)}
      </>
    );
  }
  if (proposal.relationship) {
    const { from, to, forward } = proposal.relationship;
    return (
      <>
        <strong>{from}</strong> es {forward} <strong>{to}</strong>
      </>
    );
  }
  if (proposal.attribute) {
    const { element, name, value } = proposal.attribute;
    return (
      <>
        <strong>{element}</strong> · {name}: {value}
      </>
    );
  }
  return null;
}

interface CorrectionProps {
  proposal: Proposal;
  busy: boolean;
  onAccept(changes: ProposalChanges): void;
  onCancel(): void;
}

/** The fields the writer may correct before accepting: what is left as it was is not sent. */
function Correction({ proposal, busy, onAccept, onCancel }: CorrectionProps) {
  const id = useId();
  const [name, setName] = useState(proposal.element?.name ?? "");
  const [kind, setKind] = useState<ElementKind>(proposal.element?.kind ?? "character");
  const [otherKind, setOtherKind] = useState(proposal.element?.otherKind ?? "");
  const [forward, setForward] = useState(proposal.relationship?.forward ?? "");
  const [inverse, setInverse] = useState(proposal.relationship?.inverse ?? "");
  const [value, setValue] = useState(proposal.attribute?.value ?? "");

  function changes(): ProposalChanges {
    const made: ProposalChanges = {};
    if (proposal.element) {
      if (name.trim() !== proposal.element.name) made.name = name.trim();
      if (kind !== proposal.element.kind) made.kind = kind;
      const other = kind === "other" ? otherKind.trim() || null : null;
      if (other !== proposal.element.otherKind) made.otherKind = other;
    }
    if (proposal.relationship) {
      if (forward.trim() !== proposal.relationship.forward) made.forward = forward.trim();
      const back = inverse.trim() || null;
      if (back !== proposal.relationship.inverse) made.inverse = back;
    }
    if (proposal.attribute && value.trim() !== proposal.attribute.value) made.value = value.trim();
    return made;
  }

  const empty =
    (proposal.element && name.trim() === "") ||
    (proposal.relationship && forward.trim() === "") ||
    (proposal.attribute && value.trim() === "");

  return (
    <form
      className="proposal-correction"
      onSubmit={(event) => {
        event.preventDefault();
        if (!empty) onAccept(changes());
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onCancel();
      }}
    >
      {proposal.element && (
        <>
          <p className="format-field">
            <label htmlFor={`${id}-name`}>Nombre</label>
            <input
              id={`${id}-name`}
              className="squire-text"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </p>
          <p className="format-field">
            <label htmlFor={`${id}-kind`}>Tipo</label>
            <select
              id={`${id}-kind`}
              value={kind}
              onChange={(event) => setKind(event.target.value as ElementKind)}
            >
              {KINDS.map((option) => (
                <option key={option} value={option}>
                  {KIND_NAMES[option].one}
                </option>
              ))}
            </select>
          </p>
          {kind === "other" && (
            <p className="format-field">
              <label htmlFor={`${id}-other`}>¿Qué es?</label>
              <input
                id={`${id}-other`}
                className="squire-text"
                value={otherKind}
                placeholder="Objeto"
                onChange={(event) => setOtherKind(event.target.value)}
              />
            </p>
          )}
        </>
      )}
      {proposal.relationship && (
        <>
          <p className="format-field">
            <label htmlFor={`${id}-forward`}>
              De {proposal.relationship.from} a {proposal.relationship.to}
            </label>
            <input
              id={`${id}-forward`}
              className="squire-text"
              value={forward}
              autoFocus
              onChange={(event) => setForward(event.target.value)}
            />
          </p>
          <p className="format-field">
            <label htmlFor={`${id}-inverse`}>
              De {proposal.relationship.to} a {proposal.relationship.from}
            </label>
            <input
              id={`${id}-inverse`}
              className="squire-text"
              value={inverse}
              onChange={(event) => setInverse(event.target.value)}
            />
          </p>
        </>
      )}
      {proposal.attribute && (
        <p className="format-field">
          <label htmlFor={`${id}-value`}>{proposal.attribute.name}</label>
          <input
            id={`${id}-value`}
            className="squire-text"
            value={value}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
          />
        </p>
      )}
      <p className="squire-actions">
        <button type="button" className="action" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="action" disabled={busy || !!empty}>
          Aceptar así
        </button>
      </p>
    </form>
  );
}

/**
 * The proposals of the squire, the most recent first, each with the passage it comes from: the writer
 * accepts, corrects and accepts, or dismisses them. Nothing enters the work until accepted.
 */
export function ProposalList({
  proposals,
  enabled,
  origin,
  onGoToPassage,
  onProblem,
}: ProposalListProps) {
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, work: () => Promise<unknown>) {
    setBusy(id);
    onProblem(null);
    try {
      await work();
      setCorrecting(null);
    } catch (error) {
      onProblem(messageFor(error));
    } finally {
      setBusy(null);
    }
  }

  const accept = (id: string, changes?: ProposalChanges) =>
    void act(id, () =>
      request("proposal.accept", {
        id,
        ...(changes && Object.keys(changes).length > 0 ? { changes } : {}),
        origin,
      }),
    );
  const dismiss = (id: string) => void act(id, () => request("proposal.dismiss", { id, origin }));

  if (proposals.length === 0) {
    return (
      <p className="squire-note">
        {enabled
          ? "Sin propuestas. Al terminar un párrafo, el escudero dirá lo que encuentre."
          : "El escudero no lee esta obra. Enciéndelo en Ajustes."}
      </p>
    );
  }

  return (
    <ul className="proposal-list" aria-label="Propuestas">
      {proposals.map((proposal) => (
        <li key={proposal.id} className="proposal">
          <p className="proposal-said">
            <Said proposal={proposal} />
          </p>
          <blockquote className="proposal-passage">{shortened(proposal.passage)}</blockquote>
          {correcting === proposal.id ? (
            <Correction
              proposal={proposal}
              busy={busy === proposal.id}
              onAccept={(changes) => accept(proposal.id, changes)}
              onCancel={() => setCorrecting(null)}
            />
          ) : (
            <p className="proposal-actions">
              <button type="button" className="action" onClick={() => onGoToPassage(proposal)}>
                Ir al pasaje
              </button>
              <span className="proposal-decide">
                <button
                  type="button"
                  className="action"
                  disabled={busy === proposal.id}
                  onClick={() => dismiss(proposal.id)}
                >
                  Descartar
                </button>
                <button
                  type="button"
                  className="action"
                  disabled={busy === proposal.id}
                  onClick={() => setCorrecting(proposal.id)}
                >
                  Corregir
                </button>
                <button
                  type="button"
                  className="action"
                  disabled={busy === proposal.id}
                  onClick={() => accept(proposal.id)}
                >
                  Aceptar
                </button>
              </span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

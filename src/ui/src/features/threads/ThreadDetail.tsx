import { useEffect, useId, useState } from "react";
import { request } from "../../bridge/core";
import type { Board, ElementReferences, Milestone, Threads } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { labelFrom } from "../elements/relationship-kinds";
import { chapterPlaces, holdsAt, limitsOf } from "./layout";
import "../mentions/mentions.css";
import "../squire/squire.css";

/** What the writer looks at in the threads: a chapter, the point of a ficha in a chapter, or a milestone. */
export type ThreadSelection =
  | { kind: "chapter"; documentId: string }
  | { kind: "point"; elementId: string; documentId: string }
  | { kind: "milestone"; id: string };

export interface ThreadDetailProps {
  selection: ThreadSelection;
  threads: Threads;
  board: Board;
  origin: string;
  onGoToMention(elementId: string, documentId: string, ordinal: number): void;
  onGoToPassage(documentId: string, passage: string): void;
  onProblem(message: string | null): void;
  onClose(): void;
}

/** The side of the threads that tells about what the writer chose: a chapter, a point or a milestone. */
export function ThreadDetail(props: ThreadDetailProps) {
  const { selection, onClose } = props;
  const id = useId();
  return (
    <aside
      className="threads-detail"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        onClose();
      }}
    >
      <p className="threads-detail-close">
        <button type="button" className="action" onClick={onClose}>
          Cerrar
        </button>
      </p>
      {selection.kind === "chapter" && (
        <ChapterDetail titleId={`${id}-title`} documentId={selection.documentId} {...props} />
      )}
      {selection.kind === "point" && (
        <PointDetail
          key={`${selection.elementId}:${selection.documentId}`}
          titleId={`${id}-title`}
          elementId={selection.elementId}
          documentId={selection.documentId}
          {...props}
        />
      )}
      {selection.kind === "milestone" && (
        <MilestoneDetail
          key={selection.id}
          titleId={`${id}-title`}
          milestoneId={selection.id}
          {...props}
        />
      )}
    </aside>
  );
}

function names(board: Board): Map<string, string> {
  return new Map(board.elements.map((element) => [element.id, element.name]));
}

function chapterTitle(threads: Threads, documentId: string): string {
  return (
    threads.chapters.find((chapter) => chapter.documentId === documentId)?.title || "Sin título"
  );
}

/** The relationships of the chosen fichas that hold in a chapter, and those that start or end there. */
function ChapterDetail({
  titleId,
  documentId,
  threads,
  board,
}: ThreadDetailProps & { titleId: string; documentId: string }) {
  const places = chapterPlaces(threads);
  const place = places.get(documentId) ?? 0;
  const chosen = new Set(threads.chosen);
  const named = names(board);
  const held = board.relationships.filter(
    (relationship) =>
      (chosen.has(relationship.from) || chosen.has(relationship.to)) &&
      holdsAt(relationship, place, places),
  );
  const changes = board.relationships.filter((relationship) => {
    if (!chosen.has(relationship.from) && !chosen.has(relationship.to)) return false;
    const { starts, ends } = limitsOf(relationship, places);
    return starts === place || ends === place;
  });

  return (
    <>
      <h2 id={titleId} className="threads-detail-title small-caps">
        {chapterTitle(threads, documentId)}
      </h2>
      <h3 className="element-label">Relaciones vigentes</h3>
      {held.length === 0 ? (
        <p className="element-quiet">Ninguna relación de estas fichas en este capítulo.</p>
      ) : (
        <ul className="threads-relations" aria-label="Relaciones vigentes">
          {held.map((relationship) => {
            const { starts, ends } = limitsOf(relationship, places);
            return (
              <li key={relationship.id}>
                <strong>{named.get(relationship.from)}</strong>{" "}
                {labelFrom(relationship, relationship.from, board.ownKinds)}{" "}
                <strong>{named.get(relationship.to)}</strong>
                {starts === place && <span className="element-quiet"> · empieza aquí</span>}
                {ends === place && <span className="element-quiet"> · termina aquí</span>}
              </li>
            );
          })}
        </ul>
      )}
      {changes.some((relationship) => !held.includes(relationship)) && (
        <p className="element-quiet">Algunas relaciones cambian en este capítulo.</p>
      )}
    </>
  );
}

/** The mentions of a ficha in a chapter, to go to each one or to mark there what happens to it. */
function PointDetail({
  titleId,
  elementId,
  documentId,
  threads,
  board,
  origin,
  onGoToMention,
  onProblem,
}: ThreadDetailProps & { titleId: string; elementId: string; documentId: string }) {
  const [references, setReferences] = useState<ElementReferences | null>(null);
  const [marking, setMarking] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    void request("element.references", { id: elementId }).then(
      (value) => {
        if (current) setReferences(value);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [elementId]);

  const mentions =
    references?.documents.find((document) => document.documentId === documentId)?.mentions ?? [];
  const name = names(board).get(elementId) ?? "";

  return (
    <>
      <h2 id={titleId} className="threads-detail-title small-caps">
        {name} · {chapterTitle(threads, documentId)}
      </h2>
      {!references && <p className="element-quiet">Buscando sus menciones…</p>}
      <ul className="element-mentions-list">
        {mentions.map((mention) => (
          <li key={mention.ordinal} className="threads-mention">
            <button
              type="button"
              className="element-mention"
              onClick={() => onGoToMention(elementId, documentId, mention.ordinal)}
            >
              {mention.before}
              <mark>{mention.text}</mark>
              {mention.after}
            </button>
            {marking === mention.ordinal ? (
              <MilestoneForm
                onCancel={() => setMarking(null)}
                onSave={async (text) => {
                  onProblem(null);
                  try {
                    await request("milestone.create", {
                      elementId,
                      documentId,
                      passage: `${mention.before}${mention.text}${mention.after}`,
                      text,
                      origin,
                    });
                    setMarking(null);
                  } catch (error) {
                    onProblem(messageFor(error));
                  }
                }}
              />
            ) : (
              <button type="button" className="action" onClick={() => setMarking(mention.ordinal)}>
                Marcar hito
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** What a milestone says, to correct it, remove it or go to its passage. */
function MilestoneDetail({
  titleId,
  milestoneId,
  threads,
  board,
  origin,
  onGoToPassage,
  onProblem,
  onClose,
}: ThreadDetailProps & { titleId: string; milestoneId: string }) {
  const milestone: Milestone | undefined = threads.milestones.find(
    (candidate) => candidate.id === milestoneId,
  );
  if (!milestone) return <p className="element-quiet">Ese hito ya no está.</p>;
  const name = names(board).get(milestone.elementId) ?? "";

  return (
    <>
      <h2 id={titleId} className="threads-detail-title small-caps">
        Hito de {name} · {chapterTitle(threads, milestone.documentId)}
      </h2>
      <MilestoneForm
        initial={milestone.text}
        saveLabel="Guardar"
        onSave={async (text) => {
          onProblem(null);
          try {
            await request("milestone.update", { id: milestone.id, text, origin });
          } catch (error) {
            onProblem(messageFor(error));
          }
        }}
      />
      {milestone.lost ? (
        <p className="squire-note squire-bad">
          Sin pasaje: su párrafo ya no está en el capítulo. Bórralo o márcalo de nuevo.
        </p>
      ) : (
        <blockquote className="proposal-passage">{milestone.passage}</blockquote>
      )}
      <p className="squire-actions">
        {!milestone.lost && (
          <button
            type="button"
            className="action"
            onClick={() => onGoToPassage(milestone.documentId, milestone.passage)}
          >
            Ir al pasaje
          </button>
        )}
        <button
          type="button"
          className="action"
          onClick={() => {
            onProblem(null);
            request("milestone.delete", { id: milestone.id, origin }).then(
              onClose,
              (error: unknown) => onProblem(messageFor(error)),
            );
          }}
        >
          Borrar hito
        </button>
      </p>
    </>
  );
}

interface MilestoneFormProps {
  initial?: string;
  saveLabel?: string;
  onSave(text: string): Promise<void>;
  onCancel?(): void;
}

/** One short sentence: what happens. */
export function MilestoneForm({
  initial = "",
  saveLabel = "Marcar",
  onSave,
  onCancel,
}: MilestoneFormProps) {
  const id = useId();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const empty = text.trim() === "";

  return (
    <form
      className="threads-milestone-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (empty || busy) return;
        setBusy(true);
        void onSave(text.trim()).finally(() => setBusy(false));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !onCancel) return;
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
    >
      <label htmlFor={`${id}-text`} className="element-label">
        ¿Qué le ocurre?
      </label>
      <input
        id={`${id}-text`}
        className="squire-text"
        value={text}
        maxLength={300}
        placeholder="Muere su padre"
        autoFocus
        onChange={(event) => setText(event.target.value)}
      />
      <span className="squire-actions">
        {onCancel && (
          <button type="button" className="action" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="action"
          disabled={empty || busy || text.trim() === initial}
        >
          {saveLabel}
        </button>
      </span>
    </form>
  );
}

import { useState, type KeyboardEvent } from "react";
import { request } from "../../bridge/core";
import type { Board, Threads } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { ThreadDetail, type ThreadSelection } from "./ThreadDetail";
import { ThreadsChooser } from "./ThreadsChooser";
import {
  LAYOUT,
  chapterPlaces,
  columnX,
  drawingSize,
  limitsOf,
  milestonesByPlace,
  radiusFor,
  rowY,
  shortened,
} from "./layout";
import "./threads.css";

export interface ThreadsTabProps {
  /** Null while they are first asked for. */
  threads: Threads | null;
  board: Board;
  origin: string;
  onGoToMention(elementId: string, documentId: string, ordinal: number): void;
  onGoToPassage(documentId: string, passage: string): void;
  onProblem(message: string | null): void;
}

/** Enter or space act on what is drawn as a button. */
function pressed(event: KeyboardEvent, act: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  act();
}

/**
 * The threads of fate: the chapters in reading order, one line for each chosen ficha with a point where it
 * appears (larger the more it is named), joined where two meet in a paragraph, with what happens to it and
 * where its relationships start and end.
 */
export function ThreadsTab({
  threads,
  board,
  origin,
  onGoToMention,
  onGoToPassage,
  onProblem,
}: ThreadsTabProps) {
  const [selection, setSelection] = useState<ThreadSelection | null>(null);
  const [choosing, setChoosing] = useState(false);

  if (!threads) return <div className="threads-tab" aria-busy="true" />;

  const names = new Map(board.elements.map((element) => [element.id, element.name]));
  const rows = threads.chosen.filter((id) => names.has(id));
  const rowOf = new Map(rows.map((id, place) => [id, place]));
  const places = chapterPlaces(threads);
  const { width, height } = drawingSize(threads.chapters.length, rows.length);
  const milestones = milestonesByPlace(threads.milestones);
  const selectedChapter =
    selection?.kind === "chapter"
      ? selection.documentId
      : selection?.kind === "point"
        ? selection.documentId
        : null;

  const choose = (chosen: string[]) => {
    onProblem(null);
    request("threads.choose", { elements: chosen, origin }).catch((error: unknown) =>
      onProblem(messageFor(error)),
    );
  };

  return (
    <div className={`threads-tab${selection || choosing ? " threads-tab-detail" : ""}`}>
      <header className="threads-header">
        <h1 className="threads-title small-caps">Hilos del destino</h1>
        <button
          type="button"
          className="action"
          aria-expanded={choosing}
          onClick={() => {
            setChoosing(!choosing);
            setSelection(null);
          }}
        >
          Elegir fichas
        </button>
      </header>

      {threads.chapters.length === 0 ? (
        <p className="threads-empty">Los hilos recorren los capítulos: aún no hay ninguno.</p>
      ) : rows.length === 0 ? (
        <p className="threads-empty">
          Elige qué fichas seguir con «Elegir fichas»: sus hilos recorrerán los capítulos.
        </p>
      ) : (
        <div className="threads-scroll">
          <svg
            className="threads-drawing"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label="Hilos del destino"
          >
            {threads.chapters.map((chapter, place) => (
              <g
                key={chapter.documentId}
                className={`threads-chapter${selectedChapter === chapter.documentId ? " threads-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Capítulo ${place + 1}: ${chapter.title || "Sin título"}`}
                aria-pressed={
                  selection?.kind === "chapter" && selection.documentId === chapter.documentId
                }
                onClick={() => {
                  setChoosing(false);
                  setSelection({ kind: "chapter", documentId: chapter.documentId });
                }}
                onKeyDown={(event) =>
                  pressed(event, () => {
                    setChoosing(false);
                    setSelection({ kind: "chapter", documentId: chapter.documentId });
                  })
                }
              >
                <rect
                  className="threads-column"
                  x={LAYOUT.labels + LAYOUT.column * place}
                  y={0}
                  width={LAYOUT.column}
                  height={height}
                />
                <text className="threads-chapter-number" x={columnX(place)} y={16}>
                  {place + 1}
                </text>
                <text className="threads-chapter-title" x={columnX(place)} y={32}>
                  {shortened(chapter.title || "Sin título", 14)}
                </text>
                <title>{chapter.title || "Sin título"}</title>
              </g>
            ))}

            {rows.map((elementId, row) => {
              const y = rowY(row);
              const thread = threads.threads.find((candidate) => candidate.elementId === elementId);
              const points = thread?.points ?? [];
              const at = points
                .map((point) => places.get(point.documentId))
                .filter((place): place is number => place !== undefined);
              const name = names.get(elementId) ?? "";
              return (
                <g key={elementId} className="threads-row">
                  <text className="threads-name" x={LAYOUT.labels - 12} y={y + 5}>
                    {shortened(name, 18)}
                  </text>
                  <line
                    className="threads-line-faint"
                    x1={columnX(0)}
                    x2={columnX(threads.chapters.length - 1)}
                    y1={y}
                    y2={y}
                  />
                  {at.length > 1 && (
                    <line
                      className="threads-line"
                      x1={columnX(Math.min(...at))}
                      x2={columnX(Math.max(...at))}
                      y1={y}
                      y2={y}
                    />
                  )}
                  {board.relationships
                    .filter(
                      (relationship) =>
                        relationship.from === elementId || relationship.to === elementId,
                    )
                    .flatMap((relationship) => {
                      const { starts, ends } = limitsOf(relationship, places);
                      const other = names.get(
                        relationship.from === elementId ? relationship.to : relationship.from,
                      );
                      return [
                        starts === null ? null : (
                          <path
                            key={`${relationship.id}-starts`}
                            className="threads-limit"
                            d={`M ${columnX(starts) - LAYOUT.column / 2 + 4} ${y - 10} l -4 10 l 4 10`}
                          >
                            <title>{`Empieza su relación con ${other ?? ""}`}</title>
                          </path>
                        ),
                        ends === null ? null : (
                          <path
                            key={`${relationship.id}-ends`}
                            className="threads-limit"
                            d={`M ${columnX(ends) + LAYOUT.column / 2 - 4} ${y - 10} l 4 10 l -4 10`}
                          >
                            <title>{`Termina su relación con ${other ?? ""}`}</title>
                          </path>
                        ),
                      ];
                    })}
                </g>
              );
            })}

            {threads.meetings.map((meeting) => {
              const place = places.get(meeting.documentId);
              const first = rowOf.get(meeting.first);
              const second = rowOf.get(meeting.second);
              if (place === undefined || first === undefined || second === undefined) return null;
              return (
                <line
                  key={`${meeting.documentId}:${meeting.first}:${meeting.second}`}
                  className="threads-meeting"
                  x1={columnX(place)}
                  x2={columnX(place)}
                  y1={rowY(first)}
                  y2={rowY(second)}
                >
                  <title>
                    {`${names.get(meeting.first)} y ${names.get(meeting.second)}: ${
                      meeting.paragraphs === 1 ? "1 párrafo" : `${meeting.paragraphs} párrafos`
                    } juntos`}
                  </title>
                </line>
              );
            })}

            {rows.map((elementId, row) =>
              (threads.threads.find((thread) => thread.elementId === elementId)?.points ?? []).map(
                (point) => {
                  const place = places.get(point.documentId);
                  if (place === undefined) return null;
                  const name = names.get(elementId) ?? "";
                  const chapter = threads.chapters[place]!;
                  const label = `${name} en «${chapter.title || "Sin título"}»: ${
                    point.mentions === 1 ? "1 mención" : `${point.mentions} menciones`
                  }`;
                  const selected =
                    selection?.kind === "point" &&
                    selection.elementId === elementId &&
                    selection.documentId === point.documentId;
                  const open = () => {
                    setChoosing(false);
                    setSelection({ kind: "point", elementId, documentId: point.documentId });
                  };
                  return (
                    <circle
                      key={`${elementId}:${point.documentId}`}
                      className={`threads-point${selected ? " threads-selected" : ""}`}
                      cx={columnX(place)}
                      cy={rowY(row)}
                      r={radiusFor(point.mentions)}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      aria-pressed={selected}
                      onClick={open}
                      onKeyDown={(event) => pressed(event, open)}
                    >
                      <title>{label}</title>
                    </circle>
                  );
                },
              ),
            )}

            {rows.flatMap((elementId, row) =>
              threads.chapters.flatMap((chapter, place) =>
                (milestones.get(`${elementId}:${chapter.documentId}`) ?? []).map(
                  (milestone, index) => {
                    const x = columnX(place);
                    const y = rowY(row) + 18 + index * 13;
                    const open = () => {
                      setChoosing(false);
                      setSelection({ kind: "milestone", id: milestone.id });
                    };
                    const label = `Hito de ${names.get(elementId) ?? ""}: ${milestone.text}${
                      milestone.lost ? " (sin pasaje)" : ""
                    }`;
                    return (
                      <g
                        key={milestone.id}
                        className={`threads-milestone${milestone.lost ? " threads-lost" : ""}${
                          selection?.kind === "milestone" && selection.id === milestone.id
                            ? " threads-selected"
                            : ""
                        }`}
                        role="button"
                        tabIndex={0}
                        aria-label={label}
                        onClick={open}
                        onKeyDown={(event) => pressed(event, open)}
                      >
                        <path d={`M ${x - 40} ${y - 4} l 4 -4 l 4 4 l -4 4 z`} />
                        <text x={x - 30} y={y + 4}>
                          {shortened(milestone.text, 13)}
                        </text>
                        <title>{label}</title>
                      </g>
                    );
                  },
                ),
              ),
            )}
          </svg>
        </div>
      )}

      {choosing && (
        <ThreadsChooser
          elements={board.elements}
          chosen={rows}
          onChoose={choose}
          onClose={() => setChoosing(false)}
        />
      )}
      {selection && !choosing && (
        <ThreadDetail
          selection={selection}
          threads={threads}
          board={board}
          origin={origin}
          onGoToMention={onGoToMention}
          onGoToPassage={onGoToPassage}
          onProblem={onProblem}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}

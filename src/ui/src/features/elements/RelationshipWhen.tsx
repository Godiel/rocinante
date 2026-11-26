import { useId } from "react";
import { request } from "../../bridge/core";
import type { Relationship } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import type { ChapterEntry } from "./useChapters";

export interface RelationshipWhenProps {
  relationship: Relationship;
  /** How the relationship reads from the ficha, with the other one: «amigo de Claudio». */
  said: string;
  chapters: readonly ChapterEntry[];
  origin: string;
  onProblem(message: string | null): void;
  onDone(): void;
}

/**
 * The chapters a relationship holds between: from the start of the work or from a chapter, to a chapter or to
 * the end. A first chapter after the last is not offered.
 */
export function RelationshipWhen({
  relationship,
  said,
  chapters,
  origin,
  onProblem,
  onDone,
}: RelationshipWhenProps) {
  const id = useId();
  const place = (chapter: string | null) =>
    chapter === null ? -1 : chapters.findIndex((each) => each.id === chapter);
  const first = place(relationship.starts);
  const last = place(relationship.ends);

  const change = (bounds: { starts?: string | null; ends?: string | null }) => {
    onProblem(null);
    request("relationship.update", { id: relationship.id, ...bounds, origin }).catch(
      (error: unknown) => onProblem(messageFor(error)),
    );
  };

  return (
    <fieldset
      className="element-relation-when"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDone();
      }}
    >
      <legend className="visually-hidden">Cuándo vale «{said}»</legend>
      <label htmlFor={`${id}-starts`}>Desde</label>{" "}
      <select
        id={`${id}-starts`}
        value={first < 0 ? "" : relationship.starts!}
        onChange={(event) => change({ starts: event.target.value || null })}
      >
        <option value="">el principio</option>
        {chapters.map((chapter, index) => (
          <option key={chapter.id} value={chapter.id} disabled={last >= 0 && index > last}>
            {index + 1}. {chapter.title || "Sin título"}
          </option>
        ))}
      </select>{" "}
      <label htmlFor={`${id}-ends`}>hasta</label>{" "}
      <select
        id={`${id}-ends`}
        value={last < 0 ? "" : relationship.ends!}
        onChange={(event) => change({ ends: event.target.value || null })}
      >
        <option value="">el final</option>
        {chapters.map((chapter, index) => (
          <option key={chapter.id} value={chapter.id} disabled={first >= 0 && index < first}>
            {index + 1}. {chapter.title || "Sin título"}
          </option>
        ))}
      </select>{" "}
      <button type="button" className="action" onClick={onDone}>
        Listo
      </button>
    </fieldset>
  );
}

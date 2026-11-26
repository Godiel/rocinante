import { useId, useState } from "react";
import { request } from "../../bridge/core";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { MilestoneForm } from "./ThreadDetail";
import "../squire/squire.css";
import "./threads.css";

export interface MilestoneSlipProps {
  /** The paragraph the writer chose, as it is now. */
  paragraph: string;
  documentId: string;
  elements: readonly ElementSummary[];
  origin: string;
  /** Saves what is still on the page, so the core finds the paragraph as it is now. */
  beforeMarking?(): Promise<unknown>;
  onDone(): void;
  onProblem(message: string | null): void;
}

/** Whether a ficha is named in a text, by its name or an alias, without case. */
function namedIn(text: string, element: ElementSummary): boolean {
  const lower = text.toLocaleLowerCase("es");
  return [element.name, ...element.aliases].some((name) =>
    lower.includes(name.toLocaleLowerCase("es")),
  );
}

/**
 * Marks what happens to a ficha at the paragraph the writer chose in the text: the fichas named in it come
 * first, the one named first already chosen.
 */
export function MilestoneSlip({
  paragraph,
  documentId,
  elements,
  origin,
  beforeMarking,
  onDone,
  onProblem,
}: MilestoneSlipProps) {
  const id = useId();
  const named = elements.filter((element) => namedIn(paragraph, element));
  const others = elements
    .filter((element) => !named.includes(element))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const [elementId, setElementId] = useState(named[0]?.id ?? others[0]?.id ?? "");

  return (
    <div
      className="milestone-slip"
      role="dialog"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onDone();
      }}
    >
      <h2 id={`${id}-title`} className="threads-detail-title small-caps">
        Marcar hito
      </h2>
      {elements.length === 0 ? (
        <>
          <p className="squire-note">Un hito es de una ficha: crea antes la ficha.</p>
          <p className="squire-actions">
            <button type="button" className="action" onClick={onDone}>
              Cerrar
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="format-field">
            <label htmlFor={`${id}-element`}>Ficha</label>
            <select
              id={`${id}-element`}
              value={elementId}
              onChange={(event) => setElementId(event.target.value)}
            >
              {named.length > 0 && (
                <optgroup label="En este párrafo">
                  {named.map((element) => (
                    <option key={element.id} value={element.id}>
                      {element.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={named.length > 0 ? "Otras" : "Fichas"}>
                {others.map((element) => (
                  <option key={element.id} value={element.id}>
                    {element.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </p>
          <blockquote className="proposal-passage">
            {paragraph.length > 180 ? `${paragraph.slice(0, 180).trimEnd()}…` : paragraph}
          </blockquote>
          <MilestoneForm
            onCancel={onDone}
            onSave={async (text) => {
              onProblem(null);
              try {
                await beforeMarking?.();
                await request("milestone.create", {
                  elementId,
                  documentId,
                  passage: paragraph,
                  text,
                  origin,
                });
                onDone();
              } catch (error) {
                onProblem(messageFor(error));
              }
            }}
          />
        </>
      )}
    </div>
  );
}

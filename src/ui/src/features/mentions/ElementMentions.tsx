import { useEffect, useId, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { ElementReferences } from "../../bridge/generated/protocol";
import "./mentions.css";

/** After a change, the core is asked again once the writer pauses. */
const REFRESH_DELAY_MS = 400;

export interface ElementMentionsProps {
  elementId: string;
  /** The chapters and fragments of the work, for their titles. */
  documents: readonly { id: string; title: string }[];
  /** Takes the text to a mention: its document and its number among those of the ficha there. */
  onGoTo(documentId: string, ordinal: number): void;
  /** The fichas of the work, for the names of those that share paragraphs with this one. */
  elements?: readonly { id: string; name: string }[];
  /** Opens another ficha. */
  onOpenElement?(id: string): void;
}

/** «En el texto»: where a ficha is mentioned in the work, and the way to each mention. */
export function ElementMentions({
  elementId,
  documents,
  onGoTo,
  elements = [],
  onOpenElement,
}: ElementMentionsProps) {
  const [references, setReferences] = useState<{
    elementId: string;
    value: ElementReferences;
  } | null>(null);

  useEffect(() => {
    let current = true;
    let timer: number | undefined;
    const load = () =>
      void request("element.references", { id: elementId }).then(
        (value) => {
          if (current) setReferences({ elementId, value });
        },
        () => {},
      );
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, REFRESH_DELAY_MS);
    };
    load();
    const stops = [
      onNotification("document.changed", later),
      onNotification("elements.changed", later),
    ];
    return () => {
      current = false;
      window.clearTimeout(timer);
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, [elementId]);

  const heading = useId();
  const titles = new Map(documents.map((document) => [document.id, document.title]));
  const shown = references?.elementId === elementId ? references.value : null;
  const first = shown?.first ?? null;
  const names = new Map(elements.map((element) => [element.id, element.name]));
  const together = (shown?.together ?? []).filter((other) => names.has(other.elementId));

  return (
    <section className="element-section element-mentions" aria-labelledby={heading}>
      <h3 id={heading} className="element-label">
        En el texto
      </h3>
      {!shown && <p className="element-quiet">Buscando sus menciones…</p>}
      {shown && shown.total === 0 && <p className="element-quiet">Aún no aparece en el texto.</p>}
      {shown && shown.total > 0 && (
        <>
          <p className="element-mentions-summary">
            {shown.total === 1 ? "1 mención" : `${shown.total} menciones`} en{" "}
            {shown.chapters === 1 ? "1 capítulo" : `${shown.chapters} capítulos`}.
          </p>
          {first && (
            <p className="element-mentions-first">
              Primera aparición:{" "}
              <button
                type="button"
                className="element-relation-other"
                onClick={() => onGoTo(first.documentId, first.ordinal)}
              >
                {titles.get(first.documentId) ?? "Sin título"}
              </button>
            </p>
          )}
          {shown.documents.map((document) => (
            <div key={document.documentId} className="element-mentions-document">
              <h4 className="element-mentions-title small-caps">
                {titles.get(document.documentId) ?? "Sin título"} ({document.mentions.length})
              </h4>
              <ul className="element-mentions-list">
                {document.mentions.map((mention) => (
                  <li key={mention.ordinal}>
                    <button
                      type="button"
                      className="element-mention"
                      onClick={() => onGoTo(document.documentId, mention.ordinal)}
                    >
                      {mention.before}
                      <mark>{mention.text}</mark>
                      {mention.after}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
      {together.length > 0 && (
        <div className="element-together">
          <h4 className="element-mentions-title small-caps">Coincide con</h4>
          <ul className="element-mentions-list">
            {together.map((other) => (
              <li key={other.elementId}>
                <button
                  type="button"
                  className="element-relation-other"
                  onClick={() => onOpenElement?.(other.elementId)}
                >
                  {names.get(other.elementId)}
                </button>{" "}
                <span className="element-quiet">
                  {other.paragraphs === 1 ? "en 1 párrafo" : `en ${other.paragraphs} párrafos`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

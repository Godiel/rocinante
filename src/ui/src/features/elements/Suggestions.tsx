import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { SuggestionsGetResult } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";

/** After a change, the core is asked again once the writer pauses. */
const REFRESH_DELAY_MS = 800;

export interface SuggestionsProps {
  origin: string;
  /** Makes a ficha with this name and opens it. */
  onCreate(name: string): void;
  onProblem(message: string | null): void;
}

/**
 * The proper names the text repeats without a ficha, folded away at the foot of the list like the trash: each
 * one becomes a ficha or is dismissed for good.
 */
export function Suggestions({ origin, onCreate, onProblem }: SuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionsGetResult>([]);

  useEffect(() => {
    let current = true;
    let timer: number | undefined;
    const load = () =>
      void request("suggestions.get").then(
        (found) => {
          if (current) setSuggestions(found);
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
      onNotification("suggestions.changed", load),
    ];
    return () => {
      current = false;
      window.clearTimeout(timer);
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, []);

  if (suggestions.length === 0) return null;

  async function dismiss(name: string) {
    setSuggestions((shown) => shown.filter((suggestion) => suggestion.name !== name));
    try {
      await request("suggestion.dismiss", { name, origin });
      onProblem(null);
    } catch (error) {
      onProblem(messageFor(error));
    }
  }

  return (
    <details className="elements-suggestions">
      <summary className="small-caps">Sugerencias ({suggestions.length})</summary>
      <p className="element-quiet">Nombres que se repiten en el texto y aún no tienen ficha.</p>
      <ul className="elements-suggestions-list">
        {suggestions.map((suggestion) => (
          <li key={suggestion.name}>
            <span className="elements-suggestion-name">{suggestion.name}</span>{" "}
            <span className="element-quiet">
              ({suggestion.count === 1 ? "1 vez" : `${suggestion.count} veces`})
            </span>
            <span className="elements-suggestion-actions">
              <button
                type="button"
                className="action"
                aria-label={`Crear la ficha de «${suggestion.name}»`}
                onClick={() => onCreate(suggestion.name)}
              >
                Crear ficha
              </button>
              <button
                type="button"
                className="action"
                aria-label={`Descartar «${suggestion.name}»`}
                onClick={() => void dismiss(suggestion.name)}
              >
                Descartar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

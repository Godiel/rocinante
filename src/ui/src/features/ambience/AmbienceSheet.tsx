import { useId } from "react";
import { request } from "../../bridge/core";
import type { Ambience, Theme } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { backdropOf, paintOf, type Backdrop } from "./catalog";
import "./ambience.css";

interface AmbienceSheetProps {
  ambience: Ambience;
  /** Every background there is: the built-in ones and the writer's own images. */
  backdrops: Backdrop[];
  theme: Theme;
  origin: string;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The writer's ambience: the background behind the sheet in focus mode, and later the sounds and
 * the session goal. Every choice applies at once and is the writer's, in every work.
 */
export function AmbienceSheet({
  ambience,
  backdrops,
  theme,
  origin,
  onClose,
  onProblem,
}: AmbienceSheetProps) {
  const backgroundsId = useId();
  const chosen = backdropOf(ambience.background, backdrops).id;

  const change = (next: Ambience) =>
    request("preferences.update", { changes: { ambience: next }, origin })
      .then(() => onProblem(null))
      .catch((error: unknown) => onProblem(messageFor(error)));

  return (
    <aside
      className="sheet ambience-sheet"
      aria-label="Ambiente"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="sheet-header small-caps">
        <h2 className="sheet-title">Ambiente</h2>
        <button type="button" className="action" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <section aria-labelledby={backgroundsId}>
        <h3 id={backgroundsId} className="ambience-label small-caps">
          Fondo
        </h3>
        <p className="ambience-hint">Se ve detrás de la hoja en el modo concentración (F11).</p>
        <div className="ambience-backdrops" role="radiogroup" aria-labelledby={backgroundsId}>
          {backdrops.map((backdrop) => (
            <button
              key={backdrop.id}
              type="button"
              role="radio"
              aria-checked={backdrop.id === chosen}
              className="ambience-backdrop"
              onClick={() =>
                backdrop.id !== chosen && void change({ ...ambience, background: backdrop.id })
              }
            >
              <span
                className="ambience-swatch"
                aria-hidden="true"
                style={{ background: paintOf(backdrop, theme) ?? "var(--color-paper)" }}
              />
              <span className="ambience-name">{backdrop.name}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

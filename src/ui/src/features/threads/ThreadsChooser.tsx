import { useId } from "react";
import type { ElementSummary } from "../../bridge/generated/protocol";
import { KINDS, KIND_NAMES } from "../elements/kinds";
import { MAX_CHOSEN } from "./layout";

export interface ThreadsChooserProps {
  elements: readonly ElementSummary[];
  chosen: readonly string[];
  onChoose(chosen: string[]): void;
  onClose(): void;
}

/** The fichas the threads follow, kind by kind: ticking one adds it at the end, unticking takes it out. */
export function ThreadsChooser({ elements, chosen, onChoose, onClose }: ThreadsChooserProps) {
  const id = useId();
  const shown = new Set(chosen);
  const full = chosen.length >= MAX_CHOSEN;

  return (
    <section
      className="threads-chooser"
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <header className="threads-chooser-header">
        <h2 id={`${id}-title`} className="threads-detail-title small-caps">
          Fichas en los hilos
        </h2>
        <button type="button" className="action" onClick={onClose}>
          Listo
        </button>
      </header>
      {KINDS.map((kind) => {
        const ofKind = elements
          .filter((element) => element.kind === kind)
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        if (ofKind.length === 0) return null;
        return (
          <fieldset key={kind} className="threads-chooser-group">
            <legend className="small-caps">{KIND_NAMES[kind].group}</legend>
            {ofKind.map((element) => {
              const on = shown.has(element.id);
              return (
                <label key={element.id} className="threads-chooser-item">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && full}
                    onChange={() =>
                      onChoose(
                        on
                          ? chosen.filter((other) => other !== element.id)
                          : [...chosen, element.id],
                      )
                    }
                  />{" "}
                  {element.name}
                </label>
              );
            })}
          </fieldset>
        );
      })}
      {full && <p className="squire-note">Caben {MAX_CHOSEN} fichas a la vez.</p>}
    </section>
  );
}

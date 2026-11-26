import { useState, type ReactNode } from "react";
import type { Proposal, SquireSettings } from "../../bridge/generated/protocol";
import { squireStatus } from "./status";
import { SquireSettingsForm } from "./SquireSettingsForm";
import "./squire.css";

export interface SquirePanelProps {
  settings: SquireSettings;
  proposals: readonly Proposal[];
  loaded: boolean;
  origin: string;
  /** The tabs of the panel, shown in place of its title. */
  tabs?: ReactNode;
  /** The list of proposals, when the squire is set up. */
  children?: ReactNode;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The squire beside the text: how it is doing, its settings and the proposals it has for the writer. Until it
 * is connected, the panel shows its settings.
 */
export function SquirePanel({
  settings,
  loaded,
  origin,
  tabs,
  children,
  onClose,
  onProblem,
}: SquirePanelProps) {
  const connected = settings.provider !== null && settings.model !== null;
  const [asked, setAsked] = useState(false);
  // Settings opened because it was not connected stay open once it is: the key and the switch come next.
  if (loaded && !connected && !asked) setAsked(true);
  const showSettings = loaded && (asked || !connected);

  return (
    <aside
      className="sheet squire-panel"
      aria-label="Escudero"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        if (asked && connected) setAsked(false);
        else onClose();
      }}
    >
      <header className="sheet-header small-caps">
        {tabs ?? <h2 className="sheet-title">Escudero</h2>}
        <button type="button" className="action" onClick={onClose}>
          Cerrar
        </button>
      </header>

      {loaded && (
        <p
          className={settings.status === "problem" ? "squire-status squire-bad" : "squire-status"}
          role="status"
        >
          <span>{squireStatus(settings)}</span>
          {connected && (
            <button
              type="button"
              className="action"
              aria-expanded={showSettings}
              onClick={() => setAsked(!asked)}
            >
              {asked ? "Propuestas" : "Ajustes"}
            </button>
          )}
        </p>
      )}

      {showSettings ? (
        <SquireSettingsForm
          key={`${settings.provider}|${settings.model}|${settings.endpoint}`}
          settings={settings}
          origin={origin}
          onProblem={onProblem}
        />
      ) : (
        loaded && children
      )}
    </aside>
  );
}

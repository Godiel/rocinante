import { Component, useState, type ReactNode } from "react";
import { Fleuron } from "../design/Ornaments";
import { openLogFolder, reportProblem } from "./diagnostics";

/** A button that shows where the log is, for when the writer wants to send it along. */
export function LogFolderButton() {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        className="action"
        onClick={() => void openLogFolder().catch(() => setFailed(true))}
      >
        Abrir la carpeta de registros
      </button>
      {failed && <span className="trouble-note"> No se pudo abrir la carpeta.</span>}
    </>
  );
}

interface TroubleProps {
  message: string;
  /** Offered when starting the window again can help. */
  onReload?: () => void;
}

/** The whole window when something went badly wrong: what happened, and what can be done. */
export function Trouble({ message, onReload }: TroubleProps) {
  return (
    <div className="trouble" role="alert">
      <Fleuron className="trouble-fleuron" />
      <p className="trouble-message">{message}</p>
      <p className="trouble-actions">
        {onReload && (
          <button type="button" className="action action-main" onClick={onReload}>
            Volver a cargar la ventana
          </button>
        )}
        <LogFolderButton />
      </p>
    </div>
  );
}

/**
 * Catches what breaks while drawing the window, so the writer sees a way out instead of a blank
 * page, and the log gets what happened. What was saved stays saved.
 */
export class WindowGuard extends Component<{ children: ReactNode }, { broken: boolean }> {
  override state = { broken: false };

  static getDerivedStateFromError() {
    return { broken: true };
  }

  override componentDidCatch(error: unknown) {
    reportProblem(error);
  }

  override render() {
    if (!this.state.broken) return this.props.children;
    return (
      <Trouble
        message="Algo se ha roto en esta ventana. Lo guardado está a salvo: vuelve a cargarla para seguir escribiendo."
        onReload={() => window.location.reload()}
      />
    );
  }
}

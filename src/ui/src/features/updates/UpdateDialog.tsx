import { relaunch } from "@tauri-apps/plugin-process";
import type { Update } from "@tauri-apps/plugin-updater";
import { useId, useState } from "react";
import "../export/export.css";
import "./updates.css";

export interface UpdateDialogProps {
  update: Update;
  /** Whether Rocinante looks for new versions when a work opens. */
  checking: boolean;
  onChecking(allowed: boolean): void;
  /** Saves what is still on the page before Rocinante restarts. */
  beforeRestart(): Promise<unknown>;
  onClose(): void;
}

type Stage =
  | { kind: "asking" }
  | { kind: "installing"; got: number; total: number | null }
  | { kind: "failed" };

/**
 * A new version of Rocinante: what it brings, and the writer's word. «Actualizar y reiniciar» saves, downloads,
 * checks the signature, installs and opens the work again; «Ahora no» leaves it for the next time.
 */
export function UpdateDialog({
  update,
  checking,
  onChecking,
  beforeRestart,
  onClose,
}: UpdateDialogProps) {
  const id = useId();
  const [stage, setStage] = useState<Stage>({ kind: "asking" });

  async function install() {
    setStage({ kind: "installing", got: 0, total: null });
    try {
      await beforeRestart();
      let got = 0;
      let total: number | null = null;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? null;
        if (event.event === "Progress") got += event.data.chunkLength;
        setStage({ kind: "installing", got, total });
      });
      await relaunch();
    } catch {
      setStage({ kind: "failed" });
    }
  }

  const installing = stage.kind === "installing";

  return (
    <div className="export-backdrop">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || installing) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <h2 id={`${id}-title`} className="export-title small-caps">
          Rocinante {update.version}
        </h2>
        {stage.kind === "asking" && (
          <>
            <p>
              Hay una versión nueva de Rocinante. Tu obra se guarda antes de actualizar y se vuelve
              a abrir después.
            </p>
            {update.body && <div className="update-notes">{update.body}</div>}
            <label className="export-part">
              <input type="checkbox" checked={checking} onChange={() => onChecking(!checking)} />{" "}
              Buscar versiones nuevas al abrir una obra
            </label>
            <p className="export-actions export-footer">
              <button type="button" className="action" onClick={onClose}>
                Ahora no
              </button>
              <button
                type="button"
                className="action action-main"
                autoFocus
                onClick={() => void install()}
              >
                Actualizar y reiniciar
              </button>
            </p>
          </>
        )}
        {stage.kind === "installing" && (
          <div role="status">
            <p>Descargando e instalando la versión {update.version}…</p>
            <progress
              max={stage.total ?? undefined}
              value={stage.total ? stage.got : undefined}
              aria-label="Avance"
            />
          </div>
        )}
        {stage.kind === "failed" && (
          <>
            <p className="export-problem" role="alert">
              No se pudo actualizar: la descarga no llegó entera o su firma no es la de Rocinante,
              así que no se ha instalado nada. Tu obra está como estaba; puedes volver a intentarlo
              más tarde.
            </p>
            <p className="export-actions export-footer">
              <button type="button" className="action action-main" autoFocus onClick={onClose}>
                Cerrar
              </button>
            </p>
          </>
        )}
      </section>
    </div>
  );
}

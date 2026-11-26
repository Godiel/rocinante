import { invoke } from "@tauri-apps/api/core";
import { useEffect, useId, useRef, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { ExportFormat, ExportParts } from "../../bridge/generated/protocol";
import { messageFor, messages } from "../../app/messages";
import { reduceCover } from "../elements/reduce-image";
import { FORMATS, defaultCredits, fileName, formatInfo } from "./formats";
import { useBook } from "./useBook";
import "./export.css";

export interface ExportDialogProps {
  title: string;
  origin: string;
  /** Saves what is still on the page, so the book has the last words. */
  beforeExport(): Promise<unknown>;
  chooseExportPath(
    suggested: string,
    kind: { name: string; extension: string },
  ): Promise<string | null>;
  chooseImage(): Promise<string | null>;
  onClose(): void;
}

type Stage =
  | { kind: "choosing" }
  | { kind: "exporting"; id: string | null; done: number; total: number }
  | { kind: "done"; path: string }
  | { kind: "failed"; message: string };

/**
 * Exporting the work: the format, the parts the book carries, its author and credits (kept in the work) and,
 * for EPUB, its cover; then where to save it, the progress and, at the end, the file in its folder.
 */
export function ExportDialog({
  title,
  origin,
  beforeExport,
  chooseExportPath,
  chooseImage,
  onClose,
}: ExportDialogProps) {
  const id = useId();
  const book = useBook();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [parts, setParts] = useState<ExportParts>({ cover: true, credits: true, contents: true });
  const [author, setAuthor] = useState<string | null>(null);
  const [credits, setCredits] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "choosing" });
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const running = useRef<string | null>(null);
  // What the core announced before the dialog knew the id of its export: it writes in the background.
  const early = useRef(new Map<string, () => void>());
  // The year of the default credits, read once.
  const [year] = useState(() => new Date().getFullYear());

  const shownAuthor = author ?? book?.author ?? "";
  const shownCredits = credits ?? book?.credits ?? "";
  const coverVersion = book?.cover?.version ?? null;

  // The cover the book has, to show it.
  useEffect(() => {
    if (coverVersion === null) return;
    let current = true;
    void request("book.cover").then(
      (image) => {
        if (current) setCoverUrl(`data:${image.mediaType};base64,${image.data}`);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [coverVersion]);

  // The progress and the end of the export this dialog started.
  useEffect(() => {
    const known = early.current;
    const ours = (exportId: string, apply: () => void) => {
      if (exportId === running.current) apply();
      else if (running.current === null) known.set(exportId, apply);
    };
    const stops = [
      onNotification("export.progress", (progress) => {
        ours(progress.exportId, () =>
          setStage({
            kind: "exporting",
            id: progress.exportId,
            done: progress.done,
            total: progress.total,
          }),
        );
      }),
      onNotification("export.finished", (finished) => {
        ours(finished.exportId, () => {
          running.current = null;
          setStage(
            finished.path
              ? { kind: "done", path: finished.path }
              : { kind: "failed", message: messages[finished.reason ?? "exportFailed"] },
          );
        });
      }),
    ];
    return () => {
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, []);

  async function keepAuthor() {
    if (author === null || author.trim() === (book?.author ?? "")) return;
    try {
      await request("book.update", { changes: { author }, origin });
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function keepCredits() {
    if (credits === null || credits.trim() === (book?.credits ?? "")) return;
    try {
      await request("book.update", { changes: { credits: credits.trim() || null }, origin });
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function chooseCover() {
    setProblem(null);
    try {
      const path = await chooseImage();
      if (!path) return;
      const chosen = await request("element.readImage", { path });
      const reduced = await reduceCover(chosen);
      await request("book.setCover", { image: reduced.data, origin });
      setCoverUrl(`data:${reduced.mediaType};base64,${reduced.data}`);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function removeCover() {
    setProblem(null);
    try {
      await request("book.removeCover", { origin });
      setCoverUrl(null);
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  async function exportNow() {
    setProblem(null);
    await Promise.all([keepAuthor(), keepCredits()]);
    const info = formatInfo(format);
    const path = await chooseExportPath(fileName(title, info.extension), {
      name: info.kind,
      extension: info.extension,
    });
    if (!path) return;
    try {
      await beforeExport();
      setStage({ kind: "exporting", id: null, done: 0, total: 0 });
      const started = await request("export.run", { format, parts, path, origin });
      running.current = started.exportId;
      early.current.get(started.exportId)?.();
      early.current.clear();
    } catch (error) {
      running.current = null;
      setStage({ kind: "failed", message: messageFor(error) });
    }
  }

  const busy = stage.kind === "exporting";

  return (
    <div className="export-backdrop">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || busy) return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <h2 id={`${id}-title`} className="export-title small-caps">
          Exportar la obra
        </h2>

        {stage.kind === "choosing" && (
          <>
            <fieldset className="export-group">
              <legend className="small-caps">Formato</legend>
              {FORMATS.map((option) => (
                <label key={option.id} className="export-format">
                  <input
                    type="radio"
                    name={`${id}-format`}
                    value={option.id}
                    checked={format === option.id}
                    autoFocus={format === option.id}
                    onChange={() => setFormat(option.id)}
                  />{" "}
                  <span className="export-format-label">{option.label}</span>{" "}
                  <span className="export-quiet">{option.hint}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="export-group">
              <legend className="small-caps">Además de los capítulos</legend>
              {(
                [
                  ["cover", "Portada"],
                  ["credits", "Página de créditos"],
                  ["contents", "Índice"],
                ] as const
              ).map(([part, label]) => (
                <label key={part} className="export-part">
                  <input
                    type="checkbox"
                    checked={parts[part]}
                    onChange={() => setParts({ ...parts, [part]: !parts[part] })}
                  />{" "}
                  {label}
                </label>
              ))}
            </fieldset>

            {(parts.cover || parts.credits) && (
              <fieldset className="export-group">
                <legend className="small-caps">El libro</legend>
                {parts.cover && (
                  <p className="format-field">
                    <label htmlFor={`${id}-author`}>Autor</label>
                    <input
                      id={`${id}-author`}
                      className="export-text"
                      value={shownAuthor}
                      maxLength={200}
                      placeholder="Tu nombre o un seudónimo"
                      onChange={(event) => setAuthor(event.target.value)}
                      onBlur={() => void keepAuthor()}
                    />
                  </p>
                )}
                {parts.credits && (
                  <p className="format-field export-credits">
                    <label htmlFor={`${id}-credits`}>Créditos</label>
                    <textarea
                      id={`${id}-credits`}
                      className="export-text"
                      rows={3}
                      maxLength={2000}
                      value={shownCredits}
                      placeholder={defaultCredits(shownAuthor, year)}
                      onChange={(event) => setCredits(event.target.value)}
                      onBlur={() => void keepCredits()}
                    />
                  </p>
                )}
                {parts.cover && format === "epub" && (
                  <div className="export-cover">
                    <span>Imagen de portada</span>
                    {coverVersion !== null && coverUrl && (
                      <img src={coverUrl} alt="Portada del libro" className="export-cover-image" />
                    )}
                    <span className="export-actions">
                      <button type="button" className="action" onClick={() => void chooseCover()}>
                        {coverVersion !== null ? "Cambiar imagen" : "Elegir imagen"}
                      </button>
                      {coverVersion !== null && (
                        <button type="button" className="action" onClick={() => void removeCover()}>
                          Quitar imagen
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </fieldset>
            )}

            {problem && (
              <p className="export-problem" role="alert">
                {problem}
              </p>
            )}
            <p className="export-actions export-footer">
              <button type="button" className="action" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="action action-main" onClick={() => void exportNow()}>
                Exportar…
              </button>
            </p>
          </>
        )}

        {stage.kind === "exporting" && (
          <div className="export-progress" role="status">
            <p>
              {stage.total > 0
                ? `Exportando… ${stage.done} de ${stage.total} capítulos.`
                : "Preparando el libro…"}
            </p>
            <progress max={Math.max(1, stage.total)} value={stage.done} aria-label="Avance" />
          </div>
        )}

        {stage.kind === "done" && (
          <div role="status">
            <p>Listo: el libro está en «{stage.path.split(/[\\/]/).pop()}».</p>
            <p className="export-actions export-footer">
              <button
                type="button"
                className="action"
                onClick={() => {
                  invoke("reveal_file", { path: stage.path }).catch(() => {});
                }}
              >
                Mostrar en la carpeta
              </button>
              <button type="button" className="action action-main" autoFocus onClick={onClose}>
                Cerrar
              </button>
            </p>
          </div>
        )}

        {stage.kind === "failed" && (
          <div>
            <p className="export-problem" role="alert">
              {stage.message}
            </p>
            <p className="export-actions export-footer">
              <button type="button" className="action" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="action action-main"
                autoFocus
                onClick={() => setStage({ kind: "choosing" })}
              >
                Volver a intentarlo
              </button>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { VersionSummary } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { savePendingNow } from "../../editor/pending-saves";
import { versionDate, versionName } from "./labels";
import "./versions.css";

export interface VersionsProps {
  documentId: string;
  /** Title of the open chapter or fragment, to say whose versions these are. */
  title: string;
  origin: string;
  /** The version being looked at in the page, if any. */
  selectedId: string | null;
  /** Changes each time the writer asks to save a version (Ctrl+S), to take them to the name. */
  nameRequest: number;
  onSelect(version: VersionSummary): void;
  onClose(): void;
  onProblem(message: string | null): void;
}

/**
 * The versions of the open document, on a sheet to the right of the text: the newest first, and
 * a line at the top to keep the text as it is now under a name.
 */
export function Versions({
  documentId,
  title,
  origin,
  selectedId,
  nameRequest,
  onSelect,
  onClose,
  onProblem,
}: VersionsProps) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    const load = () =>
      request("version.list", { documentId })
        .then((list) => current && setVersions(list))
        .catch((error: unknown) => current && onProblem(messageFor(error)));
    void load();
    const unlisten = onNotification("versions.changed", (change) => {
      if (change.documentId === documentId) void load();
    });
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [documentId, onProblem]);

  useEffect(() => {
    if (nameRequest > 0) nameField.current?.focus();
  }, [nameRequest]);

  async function save() {
    try {
      // The version keeps what is on the page, including the last words typed.
      await savePendingNow();
      const version = await request("version.create", {
        documentId,
        name: name.trim() || null,
        origin,
      });
      setName("");
      setSaved(`Guardada: ${versionName(version)}.`);
      onProblem(null);
    } catch (error) {
      onProblem(messageFor(error));
    }
  }

  return (
    <aside
      className="versions"
      aria-label={`Versiones de «${title}»`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !selectedId) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="versions-header small-caps">
        <h2 className="versions-title">Versiones</h2>
        <button type="button" className="action" onClick={onClose} title="Cerrar (F6)">
          Cerrar
        </button>
      </header>
      <p className="versions-of">{title}</p>

      <form
        className="versions-save"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="versions-label small-caps" htmlFor="version-name">
          Guardar versión
        </label>
        <input
          ref={nameField}
          id="version-name"
          className="versions-name"
          value={name}
          maxLength={120}
          placeholder="Nombre (opcional)"
          onChange={(event) => {
            setName(event.target.value);
            setSaved(null);
          }}
        />
        <button type="submit" className="action action-main" title="Guardar versión (Ctrl+S)">
          Guardar
        </button>
        {saved && (
          <p className="versions-saved" role="status">
            {saved}
          </p>
        )}
      </form>

      {versions && versions.length === 0 && (
        <p className="versions-empty">
          Aún no hay versiones. Se guarda una automáticamente cada diez minutos de escritura; puedes
          guardar otra cuando quieras.
        </p>
      )}
      {versions && versions.length > 0 && (
        <ol className="versions-list">
          {versions.map((version) => (
            <li key={version.id}>
              <button
                type="button"
                className={`versions-entry versions-${version.kind}`}
                aria-pressed={version.id === selectedId}
                onClick={() => onSelect(version)}
              >
                <span className="versions-entry-name">{versionName(version)}</span>
                <span className="versions-entry-meta">
                  {versionDate(version)} · {version.statistics.words}{" "}
                  {version.statistics.words === 1 ? "palabra" : "palabras"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

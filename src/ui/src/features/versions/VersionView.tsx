import { useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { TipTapDocument, VersionSummary } from "../../bridge/generated/protocol";
import { bookExtensions } from "../../editor/extensions";
import { compare, plainText } from "./compare";
import { versionDate, versionName } from "./labels";

export interface VersionViewProps {
  version: VersionSummary;
  /** The text of the version and the text on the page now. */
  content: TipTapDocument;
  current: TipTapDocument;
  onRestore(): void;
  onBack(): void;
}

/**
 * A version in place of the page: compared with the current text, as pencil corrections, or read
 * as it was. From here it can be brought back.
 */
export function VersionView({ version, content, current, onRestore, onBack }: VersionViewProps) {
  const [reading, setReading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const paragraphs = useMemo(
    () => compare(plainText(content), plainText(current)),
    [content, current],
  );
  const changed = paragraphs.some((paragraph) =>
    paragraph.some((piece) => piece.change !== "same"),
  );

  return (
    <section
      className="version-view"
      aria-label={`Versión: ${versionName(version)}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (confirming) setConfirming(false);
          else onBack();
        }
      }}
    >
      <header className="version-view-bar">
        <p className="version-view-name">
          <span className="small-caps">{versionName(version)}</span> · {versionDate(version)}
        </p>
        <div className="version-view-actions">
          <button
            type="button"
            className="action"
            aria-pressed={!reading}
            onClick={() => setReading(!reading)}
          >
            {reading ? "Comparar con el actual" : "Leer la versión"}
          </button>
          <button type="button" className="action" onClick={() => setConfirming(true)}>
            Restaurar
          </button>
          <button type="button" className="action action-main" onClick={onBack} autoFocus>
            Volver al texto
          </button>
        </div>
        {confirming && (
          <div className="version-view-confirm" role="alertdialog" aria-label="Restaurar versión">
            <p>
              ¿Restaurar esta versión? El texto de ahora se guarda antes como versión, así que
              también podrás volver a él.
            </p>
            <div className="version-view-actions">
              <button
                type="button"
                className="action action-main"
                onClick={() => {
                  setConfirming(false);
                  onRestore();
                }}
              >
                Restaurar
              </button>
              <button
                type="button"
                className="action"
                onClick={() => setConfirming(false)}
                autoFocus
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </header>

      {reading ? (
        <ReadOnly content={content} />
      ) : (
        <div className="book-page version-compare">
          {!changed && (
            <p className="version-same">Esta versión dice lo mismo que el texto actual.</p>
          )}
          {changed && (
            <div className="version-legend small-caps">
              <ins>añadido después</ins> · <del>quitado después</del>
            </div>
          )}
          {paragraphs.map((paragraph, index) => (
            <p key={index}>
              {paragraph.map((piece, at) =>
                piece.change === "added" ? (
                  <ins key={at}>{piece.text}</ins>
                ) : piece.change === "removed" ? (
                  <del key={at}>{piece.text}</del>
                ) : (
                  <span key={at}>{piece.text}</span>
                ),
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** The version as it was written, with its formatting, and no way to change it. */
function ReadOnly({ content }: { content: TipTapDocument }) {
  const editor = useEditor({ extensions: bookExtensions(), content, editable: false });
  return <EditorContent editor={editor} className="book-page version-read" />;
}

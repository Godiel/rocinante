import { useEffect, useState, type KeyboardEvent } from "react";
import "./correction.css";

/** What was clicked: a word the speller does not know, or a punctuation problem. */
export type CorrectionTarget =
  | { kind: "spelling"; word: string; from: number; to: number }
  | { kind: "punctuation"; message: string; fix: string | null; from: number; to: number };

export interface CorrectionSlipProps {
  target: CorrectionTarget;
  /** Position inside the editor's frame, in px. */
  top: number;
  left: number;
  /** Ways to write the word right, when it is a word. */
  suggest(word: string): Promise<string[]>;
  /** Puts this text in place of the marked one. */
  onReplace(text: string): void;
  onAddWord(word: string): void;
  onIgnore(word: string): void;
  onClose(): void;
}

/**
 * A slip over a marked word or sign: what the problem is and, if the writer wants, the way to fix it. Nothing
 * changes until they choose.
 */
export function CorrectionSlip({
  target,
  top,
  left,
  suggest,
  onReplace,
  onAddWord,
  onIgnore,
  onClose,
}: CorrectionSlipProps) {
  const word = target.kind === "spelling" ? target.word : null;
  const [suggestions, setSuggestions] = useState<{ word: string; list: string[] } | null>(null);

  useEffect(() => {
    if (word === null) return;
    let current = true;
    void suggest(word).then((list) => {
      if (current) setSuggestions({ word, list });
    });
    return () => {
      current = false;
    };
  }, [word, suggest]);

  const shown = suggestions?.word === word ? suggestions.list : null;

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      className="text-popover correction-slip"
      style={{ top, left }}
      role="dialog"
      aria-label={target.kind === "spelling" ? `Ortografía de «${target.word}»` : "Puntuación"}
      onKeyDown={onKeyDown}
    >
      {target.kind === "spelling" ? (
        <>
          <p className="text-popover-title small-caps">«{target.word}» no está en el diccionario</p>
          {shown === null && <p className="correction-quiet">Buscando sugerencias…</p>}
          {shown !== null && shown.length === 0 && (
            <p className="correction-quiet">No hay sugerencias.</p>
          )}
          {shown !== null && shown.length > 0 && (
            <ul className="correction-suggestions" aria-label="Sugerencias">
              {shown.map((suggestion, index) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    className="action"
                    autoFocus={index === 0}
                    onClick={() => onReplace(suggestion)}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="text-popover-actions">
            <button type="button" className="action" onClick={() => onAddWord(target.word)}>
              Añadir al diccionario
            </button>
            <button type="button" className="action" onClick={() => onIgnore(target.word)}>
              Ignorar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-popover-title small-caps">Puntuación</p>
          <p className="correction-message">{target.message}</p>
          <div className="text-popover-actions">
            {target.fix !== null && (
              <button
                type="button"
                className="action action-main"
                autoFocus
                onClick={() => onReplace(target.fix!)}
              >
                Corregir
              </button>
            )}
            <button type="button" className="action" onClick={onClose}>
              Dejarlo así
            </button>
          </div>
        </>
      )}
    </div>
  );
}

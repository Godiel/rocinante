import { useState } from "react";
import type { DocumentKind, Statistics } from "../../bridge/generated/protocol";
import "./counter.css";

/** Where the text being written stands with the core. */
export type SaveState =
  { kind: "saved" } | { kind: "typing" } | { kind: "saving" } | { kind: "failed"; message: string };

export interface CounterProps {
  /** The counts of the open chapter or fragment, if one is open. */
  document: Statistics | null;
  kind: DocumentKind;
  /** The counts of every chapter: fragments and the trash are not the work. */
  work: Statistics;
  chapters: number;
  save: SaveState;
  /** Hidden, only a failed save still shows: the writer must know. */
  visible: boolean;
  onHide(): void;
}

// Spanish groups thousands with a point; «always» also groups four figures, as the writer asked.
const number = new Intl.NumberFormat("es-ES", { useGrouping: "always" });
const count = (value: number) => number.format(value);

/**
 * The counts in a corner of the page: one quiet line that opens into the full table. It fades
 * while the writer types and says something about saving only when it matters.
 */
export function Counter({ document, kind, work, chapters, save, visible, onHide }: CounterProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = visible && (pinned || hovered);
  const quiet = save.kind === "typing" || save.kind === "saving";
  const words = document?.words ?? 0;

  return (
    <aside
      className={`counter${quiet ? " counter-quiet" : ""}`}
      aria-label="Contador"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {visible && save.kind === "saving" && (
        <p className="counter-saving" role="status">
          Guardando…
        </p>
      )}
      {save.kind === "failed" && (
        <p className="counter-failed" role="alert">
          No se pudo guardar. {save.message} Se volverá a intentar.
        </p>
      )}
      {open && (
        <table className="counter-table" id="counter-table">
          <thead>
            <tr>
              <td />
              <th scope="col" className="small-caps">
                {kind === "chapter" ? "Capítulo" : "Fragmento"}
              </th>
              <th scope="col" className="small-caps">
                Obra
              </th>
            </tr>
          </thead>
          <tbody>
            <Row label="Palabras" document={document?.words} work={work.words} />
            <Row label="Caracteres" document={document?.characters} work={work.characters} />
            <Row label="Párrafos" document={document?.paragraphs} work={work.paragraphs} />
            <Row label="Capítulos" work={chapters} />
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>
                <button type="button" className="action counter-hide" onClick={onHide}>
                  Ocultar contador
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {visible && (
        <button
          type="button"
          className="counter-line"
          aria-expanded={open}
          aria-controls="counter-table"
          onClick={() => setPinned(!pinned)}
        >
          {count(words)} {words === 1 ? "palabra" : "palabras"}
          <span className="counter-work"> · obra {count(work.words)}</span>
        </button>
      )}
    </aside>
  );
}

function Row({ label, document, work }: { label: string; document?: number; work: number }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{document === undefined ? "" : count(document)}</td>
      <td>{count(work)}</td>
    </tr>
  );
}

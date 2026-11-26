import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ElementSummary, Note } from "../../bridge/generated/protocol";
import { byName } from "../elements/search";
import {
  ALL_NOTES,
  filterNotes,
  orderNotes,
  preview,
  type NoteClass,
  type NoteFilter,
} from "./notes-list";
import { OpenNote } from "./OpenNote";
import "./notes.css";

/** A chapter or fragment of the work, as the notes name it. */
export interface NoteDocument {
  id: string;
  title: string;
}

/** What the panel shows in place of the list: a note, or a new idea not yet written. */
export type OpenedNote = { id: string } | { draft: true; elements: string[] };

export interface NotesPanelProps {
  notes: readonly Note[];
  loaded: boolean;
  /** The chapters and fragments of the work, in the order of the index. */
  documents: readonly NoteDocument[];
  /** The document open in the text, for «the open chapter». */
  currentDocumentId: string | null;
  /** The fichas in the work: those in the trash are not shown with the notes. */
  elements: readonly ElementSummary[];
  origin: string;
  opened: OpenedNote | null;
  /** The tabs of the panel, shown in place of its title. */
  tabs?: ReactNode;
  onOpen(opened: OpenedNote | null): void;
  onGoToPassage(note: Note): void;
  onDelete(note: Note): void;
  onOpenElement(id: string): void;
  onClose(): void;
  onProblem(message: string | null): void;
}

const CLASSES: { value: NoteClass | ""; label: string }[] = [
  { value: "", label: "Todas las notas" },
  { value: "text", label: "En el texto" },
  { value: "idea", label: "Ideas sueltas" },
  { value: "elements", label: "Con fichas" },
];

const CURRENT = "current";

/**
 * The notes of the work beside the text: loose ideas and the notes of every chapter, with filters that add
 * up and, when the writer picks one, the note itself in place of the list.
 */
export function NotesPanel({
  notes,
  loaded,
  documents,
  currentDocumentId,
  elements,
  origin,
  opened,
  tabs,
  onOpen,
  onGoToPassage,
  onDelete,
  onOpenElement,
  onClose,
  onProblem,
}: NotesPanelProps) {
  const [filter, setFilter] = useState<NoteFilter & { chapter: string }>({
    ...ALL_NOTES,
    chapter: "",
  });
  const [cameBack, setCameBack] = useState(false);
  // A new idea becomes a note as soon as it has words: it stays open, the writer still typing in it, and
  // the note the core gave back stands in until the announcement of it arrives.
  const [track, setTrack] = useState<{
    opened: OpenedNote | null;
    key: number;
    created: Note | null;
    becoming: boolean;
  }>({ opened, key: 0, created: null, becoming: false });
  if (track.opened !== opened) {
    const becameNote =
      track.becoming && opened !== null && "id" in opened && opened.id === track.created?.id;
    setTrack({
      opened,
      key: becameNote ? track.key : track.key + 1,
      created: becameNote ? track.created : null,
      becoming: false,
    });
  }
  const ids = useId();
  const inWork = useMemo(() => new Set(elements.map((element) => element.id)), [elements]);
  // A note in a chapter that went to the trash, or set aside in another window, gives its place back.
  const openNote =
    opened && "id" in opened
      ? (notes.find((note) => note.id === opened.id) ??
        (track.created?.id === opened.id ? track.created : null))
      : null;
  const showing = opened && "draft" in opened ? opened : openNote ? opened : null;

  const documentId =
    filter.chapter === CURRENT ? currentDocumentId : filter.chapter === "" ? null : filter.chapter;
  const hidden = useMemo(() => {
    const gone = new Set<string>();
    for (const note of notes) for (const id of note.elements) if (!inWork.has(id)) gone.add(id);
    return gone;
  }, [notes, inWork]);
  const shown = useMemo(
    () => orderNotes(filterNotes(notes, { ...filter, documentId }, hidden), documentId !== null),
    [notes, filter, documentId, hidden],
  );
  const titles = useMemo(
    () => new Map(documents.map((document) => [document.id, document.title])),
    [documents],
  );
  const names = useMemo(
    () => new Map(elements.map((element) => [element.id, element.name])),
    [elements],
  );

  const back = () => {
    setCameBack(true);
    onOpen(null);
  };

  return (
    <aside
      className="sheet notes-panel"
      aria-label="Notas de la obra"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        // The text of a note keeps its own keys, but Escape still takes the writer back to the list.
        const target = event.target as HTMLElement;
        if (target.closest("[data-own-keys]") && !target.closest(".note-editor")) return;
        event.preventDefault();
        if (showing) back();
        else onClose();
      }}
    >
      <header className="sheet-header small-caps">
        {showing ? (
          <button
            type="button"
            className="action notes-back"
            onClick={back}
            title="Volver a la lista (Esc)"
          >
            ← Notas
          </button>
        ) : (
          (tabs ?? <h2 className="sheet-title">Notas</h2>)
        )}
        <button type="button" className="action" onClick={onClose} title="Cerrar (Ctrl+Mayús+N)">
          Cerrar
        </button>
      </header>

      {showing ? (
        <OpenNote
          key={track.key}
          note={openNote ?? null}
          draftElements={"draft" in showing ? showing.elements : []}
          where={openNote ? whereOf(openNote, titles) : "Idea suelta"}
          elements={elements}
          origin={origin}
          onCreated={(note) => {
            setTrack((current) => ({ ...current, created: note, becoming: true }));
            onOpen({ id: note.id });
          }}
          onGoToPassage={onGoToPassage}
          onDelete={(note) => {
            onDelete(note);
            back();
          }}
          onOpenElement={onOpenElement}
          onProblem={onProblem}
        />
      ) : (
        <div className="notes-list-view">
          <NoteTools
            filter={filter}
            documents={documents}
            elements={elements}
            takesFocus={cameBack}
            ids={ids}
            onChange={(changes) => setFilter((current) => ({ ...current, ...changes }))}
            onNewIdea={() => onOpen({ draft: true, elements: [] })}
          />

          {loaded && notes.length === 0 && (
            <p className="notes-empty">
              Aún no hay notas. Escribe una idea aquí o selecciona un pasaje y pulsa Ctrl+Alt+N para
              anotarlo.
            </p>
          )}
          {loaded && notes.length > 0 && shown.length === 0 && (
            <p className="notes-empty" role="status">
              Ninguna nota coincide.
            </p>
          )}
          <ul className="notes-list" aria-label="Notas">
            {shown.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={`notes-item${note.resolvedAt ? " notes-item-resolved" : ""}`}
                  onClick={() => {
                    setCameBack(false);
                    onOpen({ id: note.id });
                  }}
                >
                  <span className="notes-item-text">{preview(note)}</span>
                  <span className="notes-item-where small-caps">
                    {whereOf(note, titles)}
                    {note.resolvedAt && " · resuelta"}
                  </span>
                  {note.elements.some((id) => names.has(id)) && (
                    <span className="notes-item-elements">
                      {note.elements.flatMap((id) => names.get(id) ?? []).join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/** Where a note belongs, as the list says it. */
function whereOf(note: Note, titles: ReadonlyMap<string, string>): string {
  if (note.documentId === null) return "Idea suelta";
  const title = titles.get(note.documentId) ?? "Sin título";
  return note.anchored ? title : `${title}, sin su pasaje`;
}

interface NoteToolsProps {
  filter: NoteFilter & { chapter: string };
  documents: readonly NoteDocument[];
  elements: readonly ElementSummary[];
  takesFocus: boolean;
  ids: string;
  onChange(changes: Partial<NoteFilter & { chapter: string }>): void;
  onNewIdea(): void;
}

function NoteTools({
  filter,
  documents,
  elements,
  takesFocus,
  ids,
  onChange,
  onNewIdea,
}: NoteToolsProps) {
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (takesFocus) search.current?.focus();
  }, [takesFocus]);

  return (
    <div className="notes-tools">
      <div className="notes-tools-row">
        <label className="notes-search">
          <span className="visually-hidden">Buscar en las notas</span>
          <input
            ref={search}
            type="search"
            value={filter.query}
            placeholder="Buscar en las notas"
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filter.query !== "") {
                event.preventDefault();
                onChange({ query: "" });
              }
            }}
          />
        </label>
        <button type="button" className="action action-main" onClick={onNewIdea}>
          Nueva idea
        </button>
      </div>
      <div className="notes-filters">
        <label htmlFor={`${ids}-class`} className="visually-hidden">
          Clase de nota
        </label>
        <select
          id={`${ids}-class`}
          value={filter.kind ?? ""}
          onChange={(event) => onChange({ kind: (event.target.value || null) as NoteClass | null })}
        >
          {CLASSES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${ids}-chapter`} className="visually-hidden">
          Capítulo
        </label>
        <select
          id={`${ids}-chapter`}
          value={filter.chapter}
          onChange={(event) => onChange({ chapter: event.target.value })}
        >
          <option value="">Todos los capítulos</option>
          <option value={CURRENT}>El capítulo abierto</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.title}
            </option>
          ))}
        </select>
        <label htmlFor={`${ids}-element`} className="visually-hidden">
          Ficha
        </label>
        <select
          id={`${ids}-element`}
          value={filter.elementId ?? ""}
          onChange={(event) => onChange({ elementId: event.target.value || null })}
        >
          <option value="">Todas las fichas</option>
          {byName(elements).map((element) => (
            <option key={element.id} value={element.id}>
              {element.name}
            </option>
          ))}
        </select>
        <label className="notes-resolved">
          <input
            type="checkbox"
            checked={filter.resolved}
            onChange={(event) => onChange({ resolved: event.target.checked })}
          />{" "}
          Ver resueltas
        </label>
      </div>
    </div>
  );
}

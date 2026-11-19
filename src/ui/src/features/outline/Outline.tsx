import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type PointerEventHandler,
} from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { request } from "../../bridge/core";
import type {
  DocumentEntry,
  DocumentKind,
  OutlineMode,
  ProjectIndex,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { savePendingNow } from "../../editor/pending-saves";
import { moveOver, orderOf, placeOf, roman, type Order } from "./order";
import "./outline.css";

export interface OutlineProps {
  index: ProjectIndex;
  /** The document open in the editor. */
  currentId: string | null;
  mode: OutlineMode;
  origin: string;
  onOpen(id: string): void;
  onModeChange(mode: OutlineMode): void;
  onClose(): void;
  /** A document went to the trash: the window offers to undo it. */
  onDeleted(entry: DocumentEntry): void;
  onProblem(message: string | null): void;
}

const LIST: Record<DocumentKind, { title: string; add: string; untitled: string; empty: string }> =
  {
    chapter: {
      title: "Capítulos",
      add: "Capítulo nuevo",
      untitled: "Capítulo sin título",
      empty: "Aún no hay capítulos. Arrastra aquí un fragmento o crea uno.",
    },
    fragment: {
      title: "Cajón de fragmentos",
      add: "Fragmento nuevo",
      untitled: "Fragmento sin título",
      empty: "Textos sueltos que aún no tienen lugar en la obra.",
    },
  };

/** How the writer left a title being renamed. */
type Finish = "enter" | "escape" | "blur";

const OTHER: Record<DocumentKind, { kind: DocumentKind; label: string }> = {
  chapter: { kind: "fragment", label: "Pasar al cajón" },
  fragment: { kind: "chapter", label: "Convertir en capítulo" },
};

/**
 * The index of the work: chapters in reading order, the drawer of fragments and the trash.
 * Documents are reordered by dragging, and dragging between the two lists converts them.
 */
export function Outline({
  index,
  currentId,
  mode,
  origin,
  onOpen,
  onModeChange,
  onClose,
  onDeleted,
  onProblem,
}: OutlineProps) {
  const [dragging, setDragging] = useState<Order | null>(null);
  // After a drop the index keeps the new order until the core's answer replaces it.
  const [dropped, setDropped] = useState<{ order: Order; base: ProjectIndex } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const order = dragging ?? (dropped && dropped.base === index ? dropped.order : orderOf(index));

  const entries = new Map(
    [...index.chapters, ...index.fragments, ...index.trash].map((entry) => [entry.id, entry]),
  );
  const titleOf = (id: string | number) => entries.get(String(id))?.title ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function act<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      const result = await action();
      onProblem(null);
      return result;
    } catch (error) {
      onProblem(messageFor(error));
      return undefined;
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    setDragging((current) => moveOver(current ?? order, String(active.id), String(over.id)));
  }

  function onDragEnd({ active }: DragEndEvent) {
    const final = dragging ?? order;
    setDragging(null);
    const id = String(active.id);
    const before = placeOf(orderOf(index), id);
    const after = placeOf(final, id);
    if (!after || (before?.kind === after.kind && before.position === after.position)) return;
    setDropped({ order: final, base: index });
    void act(() => request("document.move", { id, ...after, origin }));
  }

  async function create(kind: DocumentKind) {
    const created = await act(() =>
      request("document.create", { kind, title: LIST[kind].untitled, origin }),
    );
    if (!created) return;
    onOpen(created.id);
    setRenaming(created.id);
  }

  async function rename(entry: DocumentEntry, title: string, how: Finish) {
    setRenaming(null);
    // Enter goes on to write in it; Escape stays on its title in the index.
    requestAnimationFrame(() => {
      const target =
        how === "enter"
          ? window.document.querySelector<HTMLElement>(".book-page .ProseMirror")
          : how === "escape"
            ? window.document.querySelector<HTMLElement>(`[data-entry="${entry.id}"] .outline-open`)
            : null;
      target?.focus();
    });
    if (how === "escape") return;
    const clean = title.trim();
    if (!clean || clean === entry.title) return;
    await act(() => request("document.rename", { id: entry.id, title: clean, origin }));
  }

  async function remove(entry: DocumentEntry) {
    setConfirming(null);
    // What was just typed in it goes with it, so undoing brings it back whole.
    await savePendingNow();
    const done = await act(() => request("document.delete", { id: entry.id, origin }));
    if (done) onDeleted(entry);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Has tomado «${titleOf(active.id)}».`,
    onDragOver: ({ active, over }) =>
      over ? `«${titleOf(active.id)}» está sobre «${titleOf(over.id) || "la lista"}».` : undefined,
    onDragEnd: ({ active }) => `«${titleOf(active.id)}» queda en su nuevo lugar.`,
    onDragCancel: ({ active }) => `«${titleOf(active.id)}» vuelve a su sitio.`,
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !renaming && !confirming && !dragging) {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <aside
      className={`outline outline-${mode}`}
      aria-label="Índice de la obra"
      onKeyDown={onKeyDown}
    >
      <header className="outline-header small-caps">
        <h2 className="outline-title">Índice</h2>
        <div className="outline-controls">
          <button
            type="button"
            className="action"
            onClick={() => onModeChange(mode === "docked" ? "floating" : "docked")}
            title={mode === "docked" ? "Que flote sobre el texto" : "Fijarlo al lado del texto"}
          >
            {mode === "docked" ? "Flotar" : "Anclar"}
          </button>
          <button type="button" className="action" onClick={onClose} title="Cerrar (Ctrl+Mayús+I)">
            Cerrar
          </button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Para mover este documento pulsa Espacio, usa las flechas y vuelve a pulsar Espacio para dejarlo. Escape lo devuelve a su sitio.",
          },
        }}
        onDragStart={() => setDragging(order)}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        {(["chapter", "fragment"] as const).map((kind) => (
          <List key={kind} kind={kind} ids={order[kind]} onCreate={() => void create(kind)}>
            {order[kind].map((id, position) => {
              const entry = entries.get(id);
              if (!entry) return null;
              return (
                <Entry
                  key={id}
                  entry={entry}
                  label={kind === "chapter" ? roman(position + 1) : null}
                  isCurrent={id === currentId}
                  isRenaming={renaming === id}
                  isConfirming={confirming === id}
                  convertLabel={OTHER[kind].label}
                  onOpen={() => onOpen(id)}
                  onRename={() => setRenaming(id)}
                  onRenamed={(title, how) => void rename(entry, title, how)}
                  onConvert={() =>
                    void act(() =>
                      request("document.move", {
                        id,
                        kind: OTHER[kind].kind,
                        position: order[OTHER[kind].kind].length,
                        origin,
                      }),
                    )
                  }
                  onDelete={() => setConfirming(id)}
                  onConfirmed={() => void remove(entry)}
                  onCancel={() => {
                    setRenaming(null);
                    setConfirming(null);
                  }}
                />
              );
            })}
          </List>
        ))}
      </DndContext>

      <Trash
        entries={index.trash}
        onRestore={(entry) => void act(() => request("document.restore", { id: entry.id, origin }))}
      />
    </aside>
  );
}

function List({
  kind,
  ids,
  onCreate,
  children,
}: {
  kind: DocumentKind;
  ids: string[];
  onCreate(): void;
  children: React.ReactNode;
}) {
  // The list itself takes drops, so a document can go into an empty one.
  const { setNodeRef, isOver } = useDroppable({ id: kind });
  const headingId = `outline-${kind}`;
  return (
    <section className="outline-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="outline-section-title small-caps">
        {LIST[kind].title}
      </h3>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={`outline-list${isOver && ids.length === 0 ? " outline-list-over" : ""}`}
        >
          {children}
          {ids.length === 0 && <li className="outline-empty">{LIST[kind].empty}</li>}
        </ol>
      </SortableContext>
      <button type="button" className="action outline-add" onClick={onCreate}>
        {LIST[kind].add}
      </button>
    </section>
  );
}

interface EntryProps {
  entry: DocumentEntry;
  /** Roman numeral of a chapter; fragments have none. */
  label: string | null;
  isCurrent: boolean;
  isRenaming: boolean;
  isConfirming: boolean;
  convertLabel: string;
  onOpen(): void;
  onRename(): void;
  onRenamed(title: string, how: Finish): void;
  onConvert(): void;
  onDelete(): void;
  onConfirmed(): void;
  onCancel(): void;
}

function Entry(props: EntryProps) {
  const { entry, label, isCurrent, isRenaming, isConfirming } = props;
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: isRenaming || isConfirming });
  const [menu, setMenu] = useState(false);

  return (
    <li
      ref={setNodeRef}
      data-entry={entry.id}
      className={`outline-entry${isCurrent ? " outline-entry-current" : ""}${
        isDragging ? " outline-entry-dragging" : ""
      }`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      // The whole row can be dragged with the pointer; the keyboard drags from the handle.
      onPointerDown={listeners?.onPointerDown as PointerEventHandler | undefined}
    >
      {isConfirming ? (
        <Confirm title={entry.title} onConfirmed={props.onConfirmed} onCancel={props.onCancel} />
      ) : (
        <>
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="outline-handle"
            aria-label={`Mover «${entry.title}»`}
            {...attributes}
            onKeyDown={listeners?.onKeyDown as KeyboardEventHandler | undefined}
          >
            <span aria-hidden="true">⁞</span>
          </button>
          {label && <span className="outline-numeral">{label}</span>}
          {isRenaming ? (
            <RenameField title={entry.title} onDone={props.onRenamed} />
          ) : (
            <button
              type="button"
              className="outline-open"
              aria-current={isCurrent ? "page" : undefined}
              onClick={props.onOpen}
              onDoubleClick={props.onRename}
            >
              {entry.title}
            </button>
          )}
          {!isRenaming && (
            <EntryMenu
              title={entry.title}
              open={menu}
              onToggle={setMenu}
              items={[
                { label: "Renombrar", run: props.onRename },
                { label: props.convertLabel, run: props.onConvert },
                { label: "Eliminar…", run: props.onDelete },
              ]}
            />
          )}
        </>
      )}
    </li>
  );
}

function RenameField({
  title,
  onDone,
}: {
  title: string;
  onDone(title: string, how: Finish): void;
}) {
  const [value, setValue] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  useEffect(() => {
    input.current?.select();
  }, []);

  const finish = (how: Finish) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value, how);
  };

  return (
    <input
      ref={input}
      className="outline-rename"
      aria-label="Título"
      value={value}
      maxLength={200}
      autoFocus
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish("enter");
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish("escape");
        }
      }}
      onBlur={() => finish("blur")}
    />
  );
}

function EntryMenu({
  title,
  open,
  onToggle,
  items,
}: {
  title: string;
  open: boolean;
  onToggle(open: boolean): void;
  items: { label: string; run(): void }[];
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onToggle(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onToggle]);

  return (
    <div
      ref={root}
      className="outline-menu-root"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          onToggle(false);
          root.current?.querySelector<HTMLButtonElement>(".outline-more")?.focus();
        }
      }}
    >
      <button
        type="button"
        className="outline-more"
        aria-label={`Acciones de «${title}»`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        <span aria-hidden="true">···</span>
      </button>
      {open && (
        <div className="outline-menu" role="menu" aria-label={`Acciones de «${title}»`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="outline-menu-item"
              onClick={() => {
                onToggle(false);
                item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Confirm({
  title,
  onConfirmed,
  onCancel,
}: {
  title: string;
  onConfirmed(): void;
  onCancel(): void;
}) {
  return (
    <div
      className="outline-confirm"
      role="alertdialog"
      aria-label={`¿Enviar «${title}» a la papelera?`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className="outline-confirm-text">
        ¿Enviar «{title}» a la papelera? Su texto, notas y versiones se guardan.
      </p>
      <div className="outline-confirm-actions">
        <button type="button" className="action action-main" onClick={onConfirmed}>
          Eliminar
        </button>
        <button type="button" className="action" onClick={onCancel} autoFocus>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Trash({
  entries,
  onRestore,
}: {
  entries: DocumentEntry[];
  onRestore(entry: DocumentEntry): void;
}) {
  if (entries.length === 0) return null;
  return (
    <details className="outline-trash">
      <summary className="outline-section-title small-caps">Papelera ({entries.length})</summary>
      <ul className="outline-list">
        {entries.map((entry) => (
          <li key={entry.id} className="outline-trash-entry">
            <span className="outline-trash-title">{entry.title}</span>
            <button
              type="button"
              className="action"
              aria-label={`Restaurar «${entry.title}»`}
              onClick={() => onRestore(entry)}
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

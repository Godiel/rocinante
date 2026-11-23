import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useId,
  useMemo,
  useState,
  type KeyboardEventHandler,
  type PointerEventHandler,
} from "react";
import { request } from "../../bridge/core";
import type {
  Element,
  ElementChanges,
  ElementKind,
  ElementSummary,
  TipTapDocument,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { DescriptionEditor } from "./DescriptionEditor";
import { draftOf, newKey, problemsOf, type AttributeDraft, type ElementDraft } from "./draft";
import { useElementImage } from "./images";
import { KIND_NAMES, KINDS } from "./kinds";
import { reduceImage } from "./reduce-image";
import { sharedNames } from "./search";
import { useElementSaver } from "./useElementSaver";
import "./elements.css";

export interface ElementSheetProps {
  element: Element;
  /** The elements in the work, to tell the writer when another goes by the same name. */
  others: readonly ElementSummary[];
  origin: string;
  /** Asks for an image file; null if the writer cancels. */
  chooseImage(): Promise<string | null>;
  /** Opens another ficha. */
  onOpen(id: string): void;
  onProblem(message: string | null): void;
}

/** Everything the writer keeps about an element: it saves itself after each pause. */
export function ElementSheet({
  element,
  others,
  origin,
  chooseImage,
  onOpen,
  onProblem,
}: ElementSheetProps) {
  const ids = useId();
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(element));
  const [synced, setSynced] = useState(element);
  const [newAlias, setNewAlias] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const saver = useElementSaver(element.id, origin, {
    onProblem,
    onIdle: () => setDirty(false),
  });

  // A change from another window shows at once, unless the writer has their own on the way.
  if (synced !== element && !dirty) {
    setSynced(element);
    setDraft((current) => draftOf(element, current));
  }

  const problems = problemsOf(draft);
  const shared = useMemo(() => {
    const names = sharedNames([...others.filter((other) => other.id !== element.id), element]);
    return (names.get(element.id) ?? [])
      .map((id) => others.find((other) => other.id === id))
      .filter((other): other is ElementSummary => other !== undefined);
  }, [others, element]);

  function edit(next: ElementDraft) {
    setDraft(next);
    setDirty(true);
    const nextProblems = problemsOf(next);
    const changes: ElementChanges = {};
    if (!nextProblems.name) changes.name = next.name;
    if (!nextProblems.otherKind) {
      changes.kind = next.kind;
      changes.otherKind = next.kind === "other" ? next.otherKind : null;
    }
    changes.aliases = next.aliases.map((alias) => alias.trim()).filter((alias) => alias !== "");
    if (!nextProblems.attributes) {
      changes.attributes = next.attributes.map(({ name, value }) => ({ name, value }));
    }
    saver.change(changes);
  }

  function describe(content: TipTapDocument) {
    setDirty(true);
    saver.change({ description: content });
  }

  function addAlias() {
    const alias = newAlias.trim();
    if (alias === "") return;
    edit({ ...draft, aliases: [...draft.aliases, alias] });
    setNewAlias("");
  }

  function setAttribute(key: string, part: Partial<AttributeDraft>) {
    edit({
      ...draft,
      attributes: draft.attributes.map((attribute) =>
        attribute.key === key ? { ...attribute, ...part } : attribute,
      ),
    });
  }

  async function putImage() {
    const path = await chooseImage();
    if (!path) return;
    setImageBusy(true);
    try {
      const chosen = await request("element.readImage", { path });
      const { image, thumbnail } = await reduceImage(chosen);
      await request("element.setImage", {
        id: element.id,
        image: image.data,
        thumbnail: thumbnail.data,
        origin,
      });
      onProblem(null);
    } catch (error) {
      onProblem(
        error instanceof Error && !("code" in error)
          ? "No se pudo leer esa imagen. Prueba con otra en PNG, JPEG o WebP."
          : messageFor(error),
      );
    } finally {
      setImageBusy(false);
    }
  }

  function removeImage() {
    request("element.removeImage", { id: element.id, origin }).then(
      () => onProblem(null),
      (error: unknown) => onProblem(messageFor(error)),
    );
  }

  const picture = useElementImage(element.id, element.image, "full");

  return (
    <div className="element-sheet">
      {picture && (
        <img className="element-picture" src={picture} alt={`Imagen de ${element.name}`} />
      )}

      <label className="element-name-field">
        <span className="visually-hidden">Nombre</span>
        <input
          className="element-name"
          value={draft.name}
          aria-invalid={problems.name ? true : undefined}
          aria-describedby={problems.name ? `${ids}-name` : undefined}
          onChange={(event) => edit({ ...draft, name: event.target.value })}
        />
      </label>
      {problems.name && (
        <p id={`${ids}-name`} className="element-problem" role="alert">
          {problems.name}
        </p>
      )}

      <div className="element-kind">
        <label>
          <span className="element-label">Tipo</span>
          <select
            value={draft.kind}
            onChange={(event) => edit({ ...draft, kind: event.target.value as ElementKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_NAMES[kind].one}
              </option>
            ))}
          </select>
        </label>
        {draft.kind === "other" && (
          <label>
            <span className="element-label">Qué es</span>
            <input
              value={draft.otherKind}
              placeholder="objeto, facción, época…"
              aria-invalid={problems.otherKind ? true : undefined}
              onChange={(event) => edit({ ...draft, otherKind: event.target.value })}
            />
          </label>
        )}
      </div>
      {problems.otherKind && (
        <p className="element-problem" role="alert">
          {problems.otherKind}
        </p>
      )}

      {shared.length > 0 && (
        <p className="element-shared" role="status">
          {shared.length === 1 ? "Otra ficha se llama igual: " : "Otras fichas se llaman igual: "}
          {shared.map((other, index) => (
            <span key={other.id}>
              {index > 0 && ", "}
              <button className="action" onClick={() => onOpen(other.id)}>
                {other.name}
              </button>
            </span>
          ))}
          .
        </p>
      )}

      <section className="element-section" aria-labelledby={`${ids}-aliases`}>
        <h3 id={`${ids}-aliases`} className="element-label">
          También llamado
        </h3>
        <ul className="element-aliases">
          {draft.aliases.map((alias, index) => (
            <li key={index}>
              <input
                aria-label={`Alias ${index + 1}`}
                value={alias}
                onChange={(event) =>
                  edit({
                    ...draft,
                    aliases: draft.aliases.map((each, at) =>
                      at === index ? event.target.value : each,
                    ),
                  })
                }
              />
              <button
                className="action"
                aria-label={`Quitar el alias «${alias}»`}
                onClick={() =>
                  edit({ ...draft, aliases: draft.aliases.filter((_, at) => at !== index) })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <input
          className="element-add"
          aria-label="Nuevo alias"
          placeholder="Añadir otro nombre…"
          value={newAlias}
          onChange={(event) => setNewAlias(event.target.value)}
          onBlur={addAlias}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addAlias();
            }
          }}
        />
      </section>

      <Attributes
        attributes={draft.attributes}
        problem={problems.attributes}
        onChange={(attributes) => edit({ ...draft, attributes })}
        onSet={setAttribute}
      />

      <section className="element-section" aria-labelledby={`${ids}-description`}>
        <h3 id={`${ids}-description`} className="element-label">
          Descripción
        </h3>
        <DescriptionEditor
          key={element.id}
          content={element.description}
          label={`Descripción de ${element.name}`}
          dirty={dirty}
          onChange={describe}
        />
      </section>

      <section className="element-section element-image-actions" aria-label="Imagen">
        <button className="action" disabled={imageBusy} onClick={() => void putImage()}>
          {imageBusy
            ? "Preparando la imagen…"
            : element.image
              ? "Cambiar la imagen"
              : "Poner una imagen"}
        </button>
        {element.image && !imageBusy && (
          <button className="action" onClick={removeImage}>
            Quitar la imagen
          </button>
        )}
      </section>
    </div>
  );
}

interface AttributesProps {
  attributes: AttributeDraft[];
  problem: string | undefined;
  onChange(attributes: AttributeDraft[]): void;
  onSet(key: string, part: Partial<AttributeDraft>): void;
}

/** The name–value pairs, in the writer's order: they move by dragging or with the keyboard. */
function Attributes({ attributes, problem, onChange, onSet }: AttributesProps) {
  const ids = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (key: unknown) =>
    attributes.find((attribute) => attribute.key === key)?.name || "el atributo";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Mueves «${nameOf(active.id)}».`,
    onDragOver: ({ active }) => `«${nameOf(active.id)}» pasa por aquí.`,
    onDragEnd: ({ active }) => `«${nameOf(active.id)}» queda en su nuevo lugar.`,
    onDragCancel: ({ active }) => `«${nameOf(active.id)}» vuelve a donde estaba.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = attributes.findIndex((attribute) => attribute.key === active.id);
    const to = attributes.findIndex((attribute) => attribute.key === over.id);
    onChange(arrayMove(attributes, from, to));
  }

  return (
    <section className="element-section" aria-labelledby={`${ids}-attributes`}>
      <h3 id={`${ids}-attributes`} className="element-label">
        Atributos
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pulsa espacio para mover el atributo, las flechas para llevarlo y espacio otra vez para dejarlo.",
          },
          announcements,
        }}
      >
        <SortableContext
          items={attributes.map((attribute) => attribute.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="element-attributes">
            {attributes.map((attribute) => (
              <AttributeRow
                key={attribute.key}
                attribute={attribute}
                onSet={(part) => onSet(attribute.key, part)}
                onRemove={() => onChange(attributes.filter((each) => each.key !== attribute.key))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {problem && (
        <p className="element-problem" role="alert">
          {problem}
        </p>
      )}
      <button
        className="action"
        onClick={() => onChange([...attributes, { key: newKey(), name: "", value: "" }])}
      >
        Añadir un atributo
      </button>
    </section>
  );
}

interface AttributeRowProps {
  attribute: AttributeDraft;
  onSet(part: Partial<AttributeDraft>): void;
  onRemove(): void;
}

function AttributeRow({ attribute, onSet, onRemove }: AttributeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: attribute.key,
  });
  const label = attribute.name.trim() || "sin nombre";
  return (
    <li
      ref={setNodeRef}
      className={`element-attribute${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="element-handle"
        aria-label={`Mover el atributo «${label}»`}
        {...attributes}
        onPointerDown={listeners?.onPointerDown as PointerEventHandler | undefined}
        onKeyDown={listeners?.onKeyDown as KeyboardEventHandler | undefined}
      >
        ⋮
      </button>
      <input
        className="element-attribute-name"
        aria-label="Nombre del atributo"
        aria-invalid={attribute.name.trim() === "" ? true : undefined}
        value={attribute.name}
        onChange={(event) => onSet({ name: event.target.value })}
      />
      <textarea
        className="element-attribute-value"
        aria-label={`Valor de «${label}»`}
        rows={1}
        value={attribute.value}
        onChange={(event) => onSet({ value: event.target.value })}
      />
      <button className="action" aria-label={`Quitar el atributo «${label}»`} onClick={onRemove}>
        ×
      </button>
    </li>
  );
}

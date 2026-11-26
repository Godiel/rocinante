import type { ElementSummary } from "../../bridge/generated/protocol";
import { useElementImage } from "../elements/images";
import { kindLabel } from "../elements/kinds";
import { useElement } from "../elements/useBoard";
import "./mentions.css";

/** How many attributes with a value the card shows. */
const ATTRIBUTES = 3;

export interface MentionCardProps {
  /** The fichas the mention belongs to, as the board has them. */
  elements: readonly ElementSummary[];
  /** Position inside the editor's frame, in px. */
  top: number;
  left: number;
  onOpen(id: string): void;
  /** The hand is on the card: it stays while the writer reads it. */
  onEnter(): void;
  onLeave(): void;
}

/** A ficha in small, over a name in the text: what it is and a way to open it whole. */
export function MentionCard({ elements, top, left, onOpen, onEnter, onLeave }: MentionCardProps) {
  return (
    <div
      className="mention-card"
      style={{ top, left }}
      role="dialog"
      aria-label={
        elements.length === 1 ? `Ficha de ${elements[0]!.name}` : "Fichas con este nombre"
      }
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {elements.map((element) => (
        <MentionCardEntry key={element.id} element={element} onOpen={onOpen} />
      ))}
    </div>
  );
}

function MentionCardEntry({
  element,
  onOpen,
}: {
  element: ElementSummary;
  onOpen(id: string): void;
}) {
  const thumbnail = useElementImage(element.id, element.image, "thumbnail");
  const whole = useElement(element.id);
  const attributes = (whole?.attributes ?? [])
    .filter((attribute) => attribute.value.trim() !== "")
    .slice(0, ATTRIBUTES);

  return (
    <section className="mention-card-entry">
      <header className="mention-card-head">
        {thumbnail ? (
          <img className="mention-card-image" src={thumbnail} alt="" />
        ) : (
          <span className="mention-card-image mention-card-initial" aria-hidden="true">
            {element.name.slice(0, 1)}
          </span>
        )}
        <span className="mention-card-title">
          <span className="mention-card-name">{element.name}</span>
          <span className="mention-card-kind small-caps">{kindLabel(element)}</span>
        </span>
      </header>
      {attributes.length > 0 && (
        <dl className="mention-card-attributes">
          {attributes.map((attribute, index) => (
            <div key={`${attribute.name}-${index}`}>
              <dt>{attribute.name}</dt>
              <dd>{attribute.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <button type="button" className="action mention-card-open" onClick={() => onOpen(element.id)}>
        Abrir la ficha
      </button>
    </section>
  );
}

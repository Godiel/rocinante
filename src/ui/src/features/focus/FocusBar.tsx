import { useEffect, useRef, useState, type ReactNode } from "react";
import "./focus.css";

const number = new Intl.NumberFormat("es-ES", { useGrouping: "always" });

/** How close to the top edge the pointer has to come for the bar to appear. */
export const REVEAL_EDGE_PX = 8;
/** How long the bar stays once the pointer leaves it. */
export const HIDE_AFTER_MS = 2000;

interface FocusBarProps {
  /** Words of what is being written. */
  words: number;
  onLeave(): void;
  /** More controls, such as the ambience, the session goal. */
  children?: ReactNode;
}

/**
 * The only thing on screen in focus mode besides the text, and only when asked for: bringing the
 * pointer to the top edge shows it, and writing again or leaving it alone a moment hides it.
 */
export function FocusBar({ words, onLeave, children }: FocusBarProps) {
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const hiding = useRef<number | undefined>(undefined);

  useEffect(() => {
    const cancelHiding = () => window.clearTimeout(hiding.current);
    const hideLater = () => {
      cancelHiding();
      hiding.current = window.setTimeout(() => setShown(false), HIDE_AFTER_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      const over = bar.current?.contains(event.target as Node) ?? false;
      if (event.clientY <= REVEAL_EDGE_PX || over) {
        cancelHiding();
        setShown(true);
      } else {
        hideLater();
      }
    };
    // Writing again puts it away at once; moving around the bar itself does not.
    const onKeyDown = (event: KeyboardEvent) => {
      if (bar.current?.contains(event.target as Node)) return;
      if (event.key.length === 1 || event.key === "Enter" || event.key === "Backspace") {
        cancelHiding();
        setShown(false);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelHiding();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      ref={bar}
      className={`focus-bar small-caps${shown ? " focus-bar-shown" : ""}`}
      role="toolbar"
      aria-label="Modo concentración"
      aria-hidden={!shown}
      inert={!shown}
    >
      <span className="focus-bar-words" aria-live="off">
        {number.format(words)} {words === 1 ? "palabra" : "palabras"}
      </span>
      {children}
      <button type="button" className="action" title="Salir (F11 o Esc)" onClick={onLeave}>
        Salir
      </button>
    </div>
  );
}

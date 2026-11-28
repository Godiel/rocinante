import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MORE, fitting } from "./bar-fit";

/** Something the writer can do from the bar of the work. */
export interface BarItem {
  id: string;
  label: string;
  title?: string;
  /** For the items that switch something on and off. */
  pressed?: boolean;
  /** For the items that open a panel. */
  expanded?: boolean;
  className?: string;
  onSelect(): void;
  /**
   * Which go to the menu first when the bar is narrow: the lowest. `"bar"` never leaves the bar;
   * `"menu"` always lives in the menu.
   */
  priority: number | "bar" | "menu";
}

export interface BarActionsProps {
  items: readonly BarItem[];
}

/**
 * The actions of the bar of the work: as many as fit, in their order, and the rest in a menu «Más», so nothing
 * overlaps however narrow the window is. The widths are measured on a hidden copy of the items.
 */
export function BarActions({ items }: BarActionsProps) {
  const menuId = useId();
  const frame = useRef<HTMLElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [room, setRoom] = useState<number | null>(null);
  const [gap, setGap] = useState<number | undefined>(undefined);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  // How much room the bar has and how wide each item is, measured again whenever the window or the labels
  // change: the hidden copy changes size with them.
  useEffect(() => {
    const element = frame.current;
    const copy = measure.current;
    if (!element || !copy) return;
    const observe = () => {
      // A bar not laid out (hidden, or measured before the page is) has no width yet: then everything stays.
      const width = element.getBoundingClientRect().width;
      setRoom(width > 0 ? width : null);
      const spacing = parseFloat(getComputedStyle(element).columnGap);
      if (Number.isFinite(spacing)) setGap(spacing);
      const next: Record<string, number> = {};
      for (const button of copy.querySelectorAll<HTMLElement>("[data-measure]")) {
        next[button.dataset.measure!] = button.getBoundingClientRect().width;
      }
      setWidths(next);
    };
    observe();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(observe);
    observer.observe(element);
    observer.observe(copy);
    return () => observer.disconnect();
  }, []);

  const { inBar, inMenu } = fitting(items, widths, room, gap);

  // Clicking anywhere else closes the menu.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".bar-more")) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  function onMenuKey(event: KeyboardEvent) {
    const entries = [
      ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("[role^=menuitem]"),
    ];
    const at = entries.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (at + 1) % entries.length;
    else if (event.key === "ArrowUp") next = (at - 1 + entries.length) % entries.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = entries.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      moreButton.current?.focus();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    entries[next]?.focus();
  }

  return (
    <nav ref={frame} className="bar-actions" aria-label="Proyecto">
      <div ref={measure} className="bar-measure" aria-hidden="true">
        {items.map((item) => (
          <span key={item.id} data-measure={item.id} className={`action ${item.className ?? ""}`}>
            {item.label}
          </span>
        ))}
        <span data-measure={MORE} className="action">
          Más
        </span>
      </div>
      {inBar.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`action ${item.className ?? ""}`}
          title={item.title}
          aria-pressed={item.pressed}
          aria-expanded={item.expanded}
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
      {inMenu.length > 0 && (
        <span className="bar-more">
          <button
            ref={moreButton}
            type="button"
            className="action"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            onClick={() => setOpen(!open)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                document
                  .getElementById(menuId)
                  ?.querySelector<HTMLElement>("[role^=menuitem]")
                  ?.focus(),
              );
            }}
          >
            Más
          </button>
          {open && (
            <div
              id={menuId}
              role="menu"
              aria-label="Más"
              className="bar-menu"
              onKeyDown={onMenuKey}
            >
              {inMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role={item.pressed === undefined ? "menuitem" : "menuitemcheckbox"}
                  aria-checked={item.pressed}
                  className={`bar-menu-item ${item.className ?? ""}`}
                  title={item.title}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
    </nav>
  );
}

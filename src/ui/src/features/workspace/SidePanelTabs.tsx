import { useRef, type KeyboardEvent } from "react";
import type { SideTab } from "./side-panel";

const TABS: { id: SideTab; label: string; keys?: string }[] = [
  { id: "elements", label: "Fichas", keys: "Ctrl+Mayús+E" },
  { id: "notes", label: "Notas", keys: "Ctrl+Mayús+N" },
  { id: "squire", label: "Escudero" },
];

interface SidePanelTabsProps {
  tab: SideTab;
  /** Proposals of the squire waiting for the writer, shown beside its tab. */
  pending?: number;
  onShow(tab: SideTab): void;
}

/** The faces of the panel beside the text: the fichas of the work, its notes and the squire. */
export function SidePanelTabs({ tab, pending = 0, onShow }: SidePanelTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent) {
    const at = TABS.findIndex((candidate) => candidate.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (at + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (at + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    onShow(TABS[next]!.id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      className="side-tabs"
      role="tablist"
      aria-label="Fichas, notas y escudero"
      onKeyDown={onKeyDown}
    >
      {TABS.map((candidate, index) => {
        const selected = candidate.id === tab;
        return (
          <button
            key={candidate.id}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type="button"
            role="tab"
            className="side-tab small-caps"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            title={candidate.keys ? `${candidate.label} (${candidate.keys})` : candidate.label}
            onClick={() => onShow(candidate.id)}
          >
            {candidate.label}
            {candidate.id === "squire" && pending > 0 && (
              <span className="side-tab-count" aria-label={`, ${pending} propuestas`}>
                {" "}
                {pending}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

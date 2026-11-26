import { useRef, type KeyboardEvent } from "react";
import { panelId, tabId } from "./tabs";
import type { WorkspaceTab } from "./useWorkspaceTab";

const TABS: { id: WorkspaceTab; label: string; key: string }[] = [
  { id: "writing", label: "Escritura", key: "F2" },
  { id: "board", label: "Tablero", key: "F2" },
  { id: "threads", label: "Hilos", key: "F8" },
];

interface WorkspaceTabsProps {
  tab: WorkspaceTab;
  onShow(tab: WorkspaceTab): void;
}

/** The faces of the work: the text, the board of its fichas and the threads. F2 and F8 go to and fro. */
export function WorkspaceTabs({ tab, onShow }: WorkspaceTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // The arrows move along the tabs, as in any list of tabs.
  function onKeyDown(event: KeyboardEvent) {
    const at = TABS.findIndex((candidate) => candidate.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (at + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    onShow(TABS[next]!.id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      className="workspace-tabs"
      role="tablist"
      aria-label="Vistas de la obra"
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
            id={tabId(candidate.id)}
            type="button"
            role="tab"
            className="workspace-tab"
            aria-selected={selected}
            aria-controls={panelId(candidate.id)}
            tabIndex={selected ? 0 : -1}
            title={`${candidate.label} (${candidate.key})`}
            onClick={() => onShow(candidate.id)}
          >
            {candidate.label}
          </button>
        );
      })}
    </div>
  );
}

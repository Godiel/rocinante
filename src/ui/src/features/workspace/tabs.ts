import type { WorkspaceTab } from "./useWorkspaceTab";

/** The ids that tie each tab to what it shows, for screen readers. */
export function tabId(tab: WorkspaceTab): string {
  return `workspace-tab-${tab}`;
}

export function panelId(tab: WorkspaceTab): string {
  return `workspace-panel-${tab}`;
}

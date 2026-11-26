import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type {
  Proposal,
  SquireChangedNotification,
  SquireSettings,
} from "../../bridge/generated/protocol";

export const NO_SQUIRE: SquireSettings = {
  provider: null,
  model: null,
  endpoint: null,
  hasKey: false,
  enabled: false,
  status: "off",
  problem: null,
  pending: 0,
};

/** The proposals after a change: new and updated ones in, removed ones out, the most recent first. */
export function applySquireChange(
  proposals: readonly Proposal[],
  change: Pick<SquireChangedNotification, "proposals" | "removed">,
): Proposal[] {
  const gone = new Set([...change.removed, ...change.proposals.map((proposal) => proposal.id)]);
  return orderProposals([
    ...proposals.filter((proposal) => !gone.has(proposal.id)),
    ...change.proposals,
  ]);
}

export function orderProposals(proposals: readonly Proposal[]): Proposal[] {
  return [...proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface SquireView {
  settings: SquireSettings;
  proposals: Proposal[];
  loaded: boolean;
}

/**
 * The squire of the open work: its settings and the proposals waiting for the writer, kept current with what
 * it reads and with what any window accepts or dismisses. `workId` names the work.
 */
export function useSquire(workId: string): SquireView {
  const [state, setState] = useState<SquireView & { workId: string }>({
    workId,
    settings: NO_SQUIRE,
    proposals: [],
    loaded: false,
  });

  useEffect(() => {
    let current = true;
    let loaded = false;
    const early: SquireChangedNotification[] = [];
    const unlisten = onNotification("squire.changed", (change) => {
      if (!loaded) {
        early.push(change);
        return;
      }
      setState((previous) => ({
        ...previous,
        settings: change.settings,
        proposals: applySquireChange(previous.proposals, change),
      }));
    });
    void Promise.all([request("squire.settings"), request("proposals.get")]).then(
      ([settings, proposals]) => {
        if (!current) return;
        loaded = true;
        setState({
          workId,
          settings: early.at(-1)?.settings ?? settings,
          proposals: early.reduce<Proposal[]>(applySquireChange, orderProposals(proposals)),
          loaded: true,
        });
      },
      () => {},
    );
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [workId]);

  return state.workId === workId
    ? { settings: state.settings, proposals: state.proposals, loaded: state.loaded }
    : { settings: NO_SQUIRE, proposals: [], loaded: false };
}

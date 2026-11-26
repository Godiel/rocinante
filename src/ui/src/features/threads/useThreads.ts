import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Threads } from "../../bridge/generated/protocol";

/** After a change, the core is asked again once the writer pauses. */
export const THREADS_REFRESH_MS = 500;

/**
 * The threads of the open work, kept current with what is written, the fichas, the index, the milestones and
 * the choice of fichas, from any window. Only while `active`: coming back asks again.
 */
export function useThreads(workId: string, active: boolean): Threads | null {
  const [state, setState] = useState<{ workId: string; threads: Threads } | null>(null);

  useEffect(() => {
    if (!active) return;
    let current = true;
    let timer: number | undefined;
    const load = () =>
      void request("threads.get").then(
        (threads) => {
          if (current) setState({ workId, threads });
        },
        () => {},
      );
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, THREADS_REFRESH_MS);
    };
    load();
    const stops = [
      onNotification("document.changed", later),
      onNotification("elements.changed", later),
      onNotification("project.changed", later),
      onNotification("milestones.changed", load),
      onNotification("threads.changed", load),
    ];
    return () => {
      current = false;
      window.clearTimeout(timer);
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, [workId, active]);

  return state?.workId === workId ? state.threads : null;
}

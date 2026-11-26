import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Threads } from "../../bridge/generated/protocol";

/** After a change, the core is asked again once the writer pauses. */
export const THREADS_REFRESH_MS = 500;

/** Once the work is open and the writer pauses, the threads are asked for ahead, so F8 shows them at once. */
export const THREADS_AHEAD_MS = 3000;

/**
 * The threads of the open work. While `active` they are kept current with what is written, the fichas, the
 * index, the milestones and the choice of fichas, from any window; coming back asks again, showing meanwhile
 * what was known. Before the first visit they are asked for once, ahead.
 */
export function useThreads(workId: string, active: boolean): Threads | null {
  const [state, setState] = useState<{ workId: string; threads: Threads } | null>(null);
  const known = state?.workId === workId;

  useEffect(() => {
    let current = true;
    let timer: number | undefined;
    const load = () =>
      void request("threads.get").then(
        (threads) => {
          if (current) setState({ workId, threads });
        },
        () => {},
      );

    if (!active) {
      if (!known) timer = window.setTimeout(load, THREADS_AHEAD_MS);
      return () => {
        current = false;
        window.clearTimeout(timer);
      };
    }

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
    // Whether something is known only matters to decide on asking ahead; asking ahead once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, active]);

  return known ? state.threads : null;
}

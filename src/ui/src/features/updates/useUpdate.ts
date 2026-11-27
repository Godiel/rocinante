import { check, type Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

/** Once the work is open and the writer is settled, Rocinante asks once whether there is a new version. */
export const UPDATE_CHECK_DELAY_MS = 5000;

/**
 * The new version of Rocinante, if there is one, asked for once after the work opens and only when the
 * writer lets Rocinante look. Without a connection, or if anything goes wrong, there is simply none.
 */
export function useUpdate(allowed: boolean): Update | null {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let current = true;
    const timer = window.setTimeout(() => {
      check().then(
        (found) => {
          if (current && found) setUpdate(found);
        },
        () => {},
      );
    }, UPDATE_CHECK_DELAY_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [allowed]);

  return allowed ? update : null;
}

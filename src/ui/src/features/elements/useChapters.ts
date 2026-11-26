import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";

export interface ChapterEntry {
  id: string;
  title: string;
}

/** The chapters of the open work in reading order, kept current with the index from any window. */
export function useChapters(): readonly ChapterEntry[] {
  const [chapters, setChapters] = useState<readonly ChapterEntry[]>([]);

  useEffect(() => {
    let current = true;
    const keep = (list: readonly { id: string; title: string }[]) => {
      if (current) setChapters(list.map(({ id, title }) => ({ id, title })));
    };
    void request("project.get").then(
      (project) => keep(project?.index?.chapters ?? []),
      () => {},
    );
    const stop = onNotification("project.changed", (change) => keep(change.project.index.chapters));
    return () => {
      current = false;
      void stop.then((unlisten) => unlisten());
    };
  }, []);

  return chapters;
}

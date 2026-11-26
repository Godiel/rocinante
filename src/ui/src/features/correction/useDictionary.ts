import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";

const NONE: readonly string[] = [];

/** The writer's own dictionary, kept current with what any window adds or takes out. */
export function useDictionary(): readonly string[] {
  const [words, setWords] = useState<readonly string[]>(NONE);

  useEffect(() => {
    let current = true;
    void request("dictionary.get").then(
      (found) => {
        if (current) setWords(found);
      },
      () => {},
    );
    const unlisten = onNotification("dictionary.changed", (change) => setWords(change.words));
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, []);

  return words;
}

import { createContext, useContext, useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";

/** After a change, the core is asked again once the writer pauses. */
const REFRESH_DELAY_MS = 600;

export interface CardMentions {
  total: number;
  chapters: number;
}

const NONE: ReadonlyMap<string, CardMentions> = new Map();

/**
 * How many times each ficha is mentioned in the text, and in how many chapters, kept current with what any
 * window writes or renames.
 */
export function useBoardMentions(): ReadonlyMap<string, CardMentions> {
  const [counts, setCounts] = useState<ReadonlyMap<string, CardMentions>>(NONE);

  useEffect(() => {
    let current = true;
    let timer: number | undefined;
    const load = () =>
      void request("board.mentions").then(
        ({ elements }) => {
          if (current)
            setCounts(
              new Map(elements.map(({ id, total, chapters }) => [id, { total, chapters }])),
            );
        },
        () => {},
      );
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, REFRESH_DELAY_MS);
    };
    load();
    const stops = [
      onNotification("document.changed", later),
      onNotification("elements.changed", later),
      onNotification("project.changed", later),
    ];
    return () => {
      current = false;
      window.clearTimeout(timer);
      for (const stop of stops) void stop.then((unlisten) => unlisten());
    };
  }, []);

  return counts;
}

/** The mentions of every card, for the cards to read without the board redrawing them all. */
export const BoardMentionsContext = createContext<ReadonlyMap<string, CardMentions>>(NONE);

export function useCardMentions(id: string): CardMentions | undefined {
  return useContext(BoardMentionsContext).get(id);
}

/** What a card says of its mentions. */
export function mentionsLine(mentions: CardMentions | undefined): string | null {
  if (!mentions) return null;
  if (mentions.total === 0) return "Sin menciones";
  const times = mentions.total === 1 ? "1 mención" : `${mentions.total} menciones`;
  const chapters = mentions.chapters === 1 ? "1 capítulo" : `${mentions.chapters} capítulos`;
  return `${times} · ${chapters}`;
}

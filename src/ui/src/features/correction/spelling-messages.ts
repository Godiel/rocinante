/** What the editor asks the speller in its worker. */
export type SpellRequest =
  { kind: "check"; words: string[] } | { kind: "suggest"; id: number; word: string };

/** What the speller answers. */
export type SpellReply =
  | { kind: "ready" }
  | { kind: "checked"; results: [string, boolean][] }
  | { kind: "suggested"; id: number; suggestions: string[] };

/**
 * Where every sound and picture that comes with the app was taken from. All of it is free of
 * rights (CC0 or public domain) and needs no credit; the authors are named all the same, here and
 * in licenses/ambience.txt, which travels with the app. A test checks that every file under
 * public/sounds and public/backgrounds is listed here, and nothing else.
 */
export interface Credit {
  /** What it is, as its author titled it. */
  work: string;
  author: string;
  /** The page it was taken from. */
  source: string;
  licence: "CC0-1.0" | "Public domain" | "Synthesised by Rocinante (MIT)";
  /** What was made from it, as paths under public/. */
  files: string[];
  /** How it was changed, if it was. */
  note?: string;
}

const typing = (sound: string, names: string[]) =>
  names.map((name) => `sounds/typing/${sound}/${name}.ogg`);

export const CREDITS: Credit[] = [
  {
    work: "Typewriter sounds",
    author: "Cassie-OrbitGames",
    source: "https://opengameart.org/content/typewriter-sounds",
    licence: "CC0-1.0",
    files: typing("typewriter", ["key-1", "key-2", "key-3", "key-4", "backspace", "enter"]),
    note: "Single strokes cut out of the recordings; the carriage return is built from them.",
  },
  {
    work: "Typewriter bell",
    author: "Rocinante",
    source: "https://github.com/Godiel/rocinante/blob/main/scripts/ambience.mjs",
    licence: "Synthesised by Rocinante (MIT)",
    files: typing("typewriter", ["bell"]),
  },
  {
    work: "Keyboard Soundpack #1 [Typing and Single Keystrokes]",
    author: "unicaegames",
    source: "https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes",
    licence: "CC0-1.0",
    files: typing("mechanical", ["key-1", "key-2", "key-3", "key-4", "backspace", "enter"]),
    note: "Six of the single keystrokes, trimmed and levelled.",
  },
  {
    work: "Pencil Sounds",
    author: "AntumDeluge (from recordings by NachtmahrTV and damsur)",
    source: "https://opengameart.org/node/132692",
    licence: "CC0-1.0",
    files: typing("quill", ["key-1", "key-2", "key-3", "key-4", "backspace", "enter"]),
    note: "Short strokes cut out of the writing, and the eraser.",
  },
  {
    work: "Rain (loopable)",
    author: "Ylmir",
    source: "https://opengameart.org/content/rain-loopable",
    licence: "CC0-1.0",
    files: ["sounds/ambient/rain.ogg"],
    note: "The third loop, levelled.",
  },
  {
    work: "Fireplace Sound loop",
    author: "PagDev",
    source: "https://opengameart.org/content/fireplace-sound-loop",
    licence: "CC0-1.0",
    files: ["sounds/ambient/fire.ogg"],
  },
  {
    work: "Birds and Wind - Ambient",
    author: "Spring Spring",
    source: "https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth",
    licence: "CC0-1.0",
    files: ["sounds/ambient/field.ogg"],
  },
  {
    work: "Café (placeholder)",
    author: "Rocinante",
    source: "https://github.com/Godiel/rocinante/blob/main/scripts/placeholder-sounds.mjs",
    licence: "Synthesised by Rocinante (MIT)",
    files: ["sounds/ambient/cafe.ogg"],
    note: "Shaped noise, until a CC0 recording of a café takes its place.",
  },
];

/** The credits as the text that travels with the app. */
export function creditsText(credits: Credit[] = CREDITS): string {
  const entries = credits.map((credit) =>
    [
      `${credit.work}`,
      `  Author: ${credit.author}`,
      `  Source: ${credit.source}`,
      `  Licence: ${credit.licence}`,
      ...(credit.note ? [`  Changes: ${credit.note}`] : []),
      `  Files: ${credit.files.join(", ")}`,
    ].join("\n"),
  );
  return [
    "Rocinante: sounds and pictures of the ambience",
    "",
    "Everything below is free of rights (CC0 or public domain) or was made for Rocinante.",
    "None of it needs credit; the authors are named with thanks.",
    "",
    ...entries.flatMap((entry) => [entry, ""]),
  ].join("\n");
}

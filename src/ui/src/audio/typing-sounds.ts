import type { TypingSound } from "../bridge/generated/protocol";

/** What a keystroke can sound like. */
export type Stroke = "key" | "enter" | "backspace" | "bell";

/** The recordings of one typing sound: several keys to choose from, and the special ones. */
export interface TypingSamples {
  name: string;
  keys: string[];
  enter: string;
  backspace: string;
  /** The typewriter's bell, near the end of a line; other sounds have none. */
  bell?: string;
}

const folder = (sound: TypingSound) => `${import.meta.env.BASE_URL}sounds/typing/${sound}`;
const keys = (sound: TypingSound) => [1, 2, 3, 4].map((n) => `${folder(sound)}/key-${n}.ogg`);

/**
 * The typing sounds that come with the app, in the order the panel shows them. They come from
 * CC0 recordings (see features/ambience/credits.ts), made by scripts/ambience.mjs.
 */
export const TYPING_SOUNDS: Record<TypingSound, TypingSamples> = {
  typewriter: {
    name: "Máquina de escribir",
    keys: keys("typewriter"),
    enter: `${folder("typewriter")}/enter.ogg`,
    backspace: `${folder("typewriter")}/backspace.ogg`,
    bell: `${folder("typewriter")}/bell.ogg`,
  },
  mechanical: {
    name: "Teclado mecánico",
    keys: keys("mechanical"),
    enter: `${folder("mechanical")}/enter.ogg`,
    backspace: `${folder("mechanical")}/backspace.ogg`,
  },
  quill: {
    name: "Lápiz sobre papel",
    keys: keys("quill"),
    enter: `${folder("quill")}/enter.ogg`,
    backspace: `${folder("quill")}/backspace.ogg`,
  },
};

export const TYPING_ORDER: TypingSound[] = ["typewriter", "mechanical", "quill"];

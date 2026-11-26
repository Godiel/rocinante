// The few parts of nspell (MIT) that Rocinante uses; the package ships no types of its own.
declare module "nspell" {
  interface Spell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): Spell;
    remove(word: string): Spell;
  }
  export default function nspell(aff: string | Uint8Array, dic?: string | Uint8Array): Spell;
}

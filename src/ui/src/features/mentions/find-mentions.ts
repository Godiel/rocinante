/**
 * Finding the names and aliases of the fichas in the text, by the rules in src/contracts/mentions.json, which
 * the core follows too: whole words; without minding case or accents, but with the ñ as a letter of its own;
 * up to three characters of any kind but letters, digits or line breaks between the words of a name; the
 * longest name wins; a name of one letter is not looked for.
 */

/** A ficha, as far as its names go. */
export interface Named {
  id: string;
  name: string;
  aliases: readonly string[];
}

/** A mention in a text: the fichas it belongs to, where it starts and how long it is, in UTF-16 units. */
export interface FoundMention {
  elements: readonly string[];
  start: number;
  length: number;
}

interface Candidate {
  words: string[];
  length: number;
  elements: string[];
}

/** The names of the fichas, ready to look for: by their first word, the longest first. */
export interface MentionIndex {
  byFirstWord: ReadonlyMap<string, readonly Candidate[]>;
}

const MAX_GAP = 3;
const WORD = /[\p{L}\p{Nd}\p{M}]/u;
const MARK = /\p{M}/u;
const LINE_BREAK = new RegExp(
  `[${[0x0a, 0x0d, 0x2028, 0x2029].map((code) => String.fromCharCode(code)).join("")}]`,
);
const COMBINING_TILDE = String.fromCharCode(0x0303);

interface Token {
  start: number;
  end: number;
  folded: string;
}

/** Lowercase and without accents, but the ñ stays a ñ, written whole or as n and a tilde. */
function fold(word: string): string {
  let folded = "";
  for (const unit of word.split("")) {
    if (unit === "ñ" || unit === "Ñ") {
      folded += "ñ";
    } else if (unit === COMBINING_TILDE && folded.endsWith("n")) {
      folded = `${folded.slice(0, -1)}ñ`;
    } else {
      for (const part of unit.normalize("NFD").split("")) {
        if (!MARK.test(part)) folded += part.toLowerCase();
      }
    }
  }
  return folded;
}

/** The words of a text: runs of letters, decimal digits and combining marks, folded. */
function tokens(text: string): Token[] {
  const found: Token[] = [];
  let index = 0;
  while (index < text.length) {
    if (!WORD.test(text[index]!)) {
      index++;
      continue;
    }
    const start = index;
    while (index < text.length && WORD.test(text[index]!)) index++;
    found.push({ start, end: index, folded: fold(text.slice(start, index)) });
  }
  return found;
}

export function mentionIndex(elements: readonly Named[]): MentionIndex {
  const byWords = new Map<string, Candidate>();
  const byFirstWord = new Map<string, Candidate[]>();
  for (const element of elements) {
    for (const name of [element.name, ...element.aliases]) {
      const words = tokens(name).map((token) => token.folded);
      if (words.reduce((sum, word) => sum + word.length, 0) < 2) continue;
      const key = words.join(" ");
      let candidate = byWords.get(key);
      if (!candidate) {
        candidate = {
          words,
          length: words.reduce((sum, word) => sum + word.length, 0),
          elements: [],
        };
        byWords.set(key, candidate);
        const list = byFirstWord.get(words[0]!) ?? [];
        list.push(candidate);
        byFirstWord.set(words[0]!, list);
      }
      if (!candidate.elements.includes(element.id)) candidate.elements.push(element.id);
    }
  }
  // The longest name is tried first, so it wins over a shorter one that starts the same.
  for (const list of byFirstWord.values()) {
    list.sort((a, b) => b.words.length - a.words.length || b.length - a.length);
  }
  return { byFirstWord };
}

function matches(
  text: string,
  found: readonly Token[],
  at: number,
  words: readonly string[],
): boolean {
  if (at + words.length > found.length) return false;
  for (let index = 0; index < words.length; index++) {
    const token = found[at + index]!;
    if (token.folded !== words[index]) return false;
    if (index > 0) {
      const gap = text.slice(found[at + index - 1]!.end, token.start);
      if (gap.length > MAX_GAP || LINE_BREAK.test(gap)) return false;
    }
  }
  return true;
}

export function findMentions(text: string, index: MentionIndex): FoundMention[] {
  const result: FoundMention[] = [];
  if (index.byFirstWord.size === 0) return result;
  const found = tokens(text);
  for (let at = 0; at < found.length;) {
    const match = index.byFirstWord
      .get(found[at]!.folded)
      ?.find((candidate) => matches(text, found, at, candidate.words));
    if (!match) {
      at++;
      continue;
    }
    const last = found[at + match.words.length - 1]!;
    result.push({
      elements: match.elements,
      start: found[at]!.start,
      length: last.end - found[at]!.start,
    });
    at += match.words.length;
  }
  return result;
}

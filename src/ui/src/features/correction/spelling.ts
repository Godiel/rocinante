import type { SpellReply, SpellRequest } from "./spelling-messages";

/** Where the answers about words come from: the worker in the app, a fake one in tests. */
export interface SpellEngine {
  post(request: SpellRequest): void;
  listen(handler: (reply: SpellReply) => void): void;
}

/** The speller in its worker, started the first time it is needed. */
export function workerEngine(): SpellEngine {
  const worker = new Worker(new URL("./spelling.worker.ts", import.meta.url), { type: "module" });
  return {
    post: (request) => worker.postMessage(request),
    listen: (handler) => {
      worker.onmessage = ({ data }: MessageEvent<SpellReply>) => handler(data);
    },
  };
}

/** A word of the text: where it starts in its paragraph and how it is written. */
export interface TextWord {
  start: number;
  word: string;
}

/** The words of a paragraph: letters, with an apostrophe or a hyphen inside, and the digits that touch them. */
export function wordsOf(text: string): TextWord[] {
  const found: TextWord[] = [];
  for (const match of text.matchAll(/[\p{L}\p{M}\p{Nd}]+(?:['’-][\p{L}\p{M}\p{Nd}]+)*/gu)) {
    found.push({ start: match.index, word: match[0] });
  }
  return found;
}

/**
 * Whether a word is left out of the spelling check: one letter, digits in it, an acronym in capitals, or a
 * word the writer accepts (their own dictionary, the names of the fichas, those ignored this session).
 */
export function leftOut(word: string, accepted: ReadonlySet<string>): boolean {
  if (word.length < 2) return true;
  if (/\p{Nd}/u.test(word)) return true;
  if (word === word.toLocaleUpperCase("es") && /\p{Lu}/u.test(word)) return true;
  return accepted.has(word) || accepted.has(word.toLocaleLowerCase("es"));
}

/**
 * The words the writer accepts besides the dictionary: their own dictionary and every word of the names and
 * aliases of the fichas, as written and in small letters.
 */
export function acceptedWords(own: readonly string[], names: readonly string[]): Set<string> {
  const accepted = new Set<string>();
  for (const word of own) {
    accepted.add(word);
    accepted.add(word.toLocaleLowerCase("es"));
  }
  for (const name of names) {
    for (const { word } of wordsOf(name)) {
      accepted.add(word);
      accepted.add(word.toLocaleLowerCase("es"));
    }
  }
  return accepted;
}

/**
 * Asks the speller about words and keeps what it says. A word not yet known is asked for in a batch with
 * others; when the answers arrive, whoever listens is told, to mark the text again.
 */
export class SpellChecker {
  private readonly known = new Map<string, boolean>();
  private readonly asked = new Set<string>();
  private queued: string[] = [];
  private flushing = false;
  private readonly listeners = new Set<() => void>();
  private readonly suggestions = new Map<number, (words: string[]) => void>();
  private nextId = 1;
  private engine: SpellEngine | null = null;

  private readonly start: () => SpellEngine;

  constructor(start: () => SpellEngine) {
    this.start = start;
  }

  /** Whether a word is right: true, false, or undefined while the speller has not said. */
  isCorrect(word: string): boolean | undefined {
    const answer = this.known.get(word);
    if (answer === undefined && !this.asked.has(word)) {
      this.asked.add(word);
      this.queued.push(word);
      this.flushSoon();
    }
    return answer;
  }

  /** Up to five ways to write a word right. */
  suggest(word: string): Promise<string[]> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.suggestions.set(id, resolve);
      this.engineNow().post({ kind: "suggest", id, word });
    });
  }

  /** Calls `listener` whenever new answers arrive. Returns the way to stop. */
  onAnswers(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private engineNow(): SpellEngine {
    if (!this.engine) {
      this.engine = this.start();
      this.engine.listen((reply) => this.receive(reply));
    }
    return this.engine;
  }

  private flushSoon() {
    if (this.flushing) return;
    this.flushing = true;
    queueMicrotask(() => {
      this.flushing = false;
      const words = this.queued;
      this.queued = [];
      if (words.length > 0) this.engineNow().post({ kind: "check", words });
    });
  }

  private receive(reply: SpellReply) {
    if (reply.kind === "checked") {
      for (const [word, correct] of reply.results) this.known.set(word, correct);
      for (const listener of this.listeners) listener();
    } else if (reply.kind === "suggested") {
      this.suggestions.get(reply.id)?.(reply.suggestions);
      this.suggestions.delete(reply.id);
    }
  }
}

let shared: SpellChecker | null = null;

/** The speller of this window, shared by its editors. */
export function spellChecker(): SpellChecker {
  shared ??= new SpellChecker(workerEngine);
  return shared;
}

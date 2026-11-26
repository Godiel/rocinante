/// <reference lib="webworker" />
// Reads the Spanish dictionary of LibreOffice (dictionary-es) and answers about words, away from the editor:
// building the speller takes a moment, and the text must not wait for it.
import nspell from "nspell";
import affUrl from "@dictionary-es/index.aff?url";
import dicUrl from "@dictionary-es/index.dic?url";
import type { SpellRequest, SpellReply } from "./spelling-messages";

const speller = (async () => {
  const [aff, dic] = await Promise.all(
    [affUrl, dicUrl].map(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer())),
  );
  return nspell(aff!, dic);
})();

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data }: MessageEvent<SpellRequest>) => {
  const spell = await speller;
  let reply: SpellReply;
  if (data.kind === "check") {
    reply = { kind: "checked", results: data.words.map((word) => [word, spell.correct(word)]) };
  } else {
    reply = { kind: "suggested", id: data.id, suggestions: spell.suggest(data.word).slice(0, 5) };
  }
  scope.postMessage(reply);
};

void speller.then(() => scope.postMessage({ kind: "ready" } satisfies SpellReply));

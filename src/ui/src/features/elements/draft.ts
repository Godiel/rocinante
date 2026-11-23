import type { Element, ElementKind } from "../../bridge/generated/protocol";

/** One attribute as the ficha edits it, with a key of its own so it keeps its row while it moves. */
export interface AttributeDraft {
  key: string;
  name: string;
  value: string;
}

/** What the ficha shows in its fields: the element as the writer is typing it. */
export interface ElementDraft {
  name: string;
  kind: ElementKind;
  otherKind: string;
  aliases: string[];
  attributes: AttributeDraft[];
}

let nextKey = 0;
export function newKey(): string {
  nextKey += 1;
  return `attribute-${nextKey}`;
}

const same = (typed: string, stored: string) => typed.trim() === stored;

/**
 * The fields for `element`, keeping what the writer typed wherever it already means what is stored: the
 * core trims names, and taking «Juan » back to «Juan» would eat the space the writer is about to follow.
 */
export function draftOf(element: Element, current?: ElementDraft): ElementDraft {
  const typedAliases = current?.aliases
    .map((alias) => alias.trim())
    .filter((alias) => alias !== "");
  const aliasesKept =
    typedAliases !== undefined &&
    typedAliases.length === element.aliases.length &&
    typedAliases.every((alias, index) => alias === element.aliases[index]);
  return {
    name: current && same(current.name, element.name) ? current.name : element.name,
    kind: element.kind,
    otherKind:
      current && element.otherKind !== null && same(current.otherKind, element.otherKind)
        ? current.otherKind
        : (element.otherKind ?? current?.otherKind ?? ""),
    aliases: aliasesKept && current ? current.aliases : [...element.aliases],
    attributes: element.attributes.map((attribute, index) => {
      const typed = current?.attributes[index];
      return typed && same(typed.name, attribute.name) && typed.value === attribute.value
        ? typed
        : { key: typed?.key ?? newKey(), name: attribute.name, value: attribute.value };
    }),
  };
}

/** Why a draft cannot be saved yet, if it cannot: the fields that would break a rule. */
export interface DraftProblems {
  name?: string;
  otherKind?: string;
  attributes?: string;
}

export function problemsOf(draft: ElementDraft): DraftProblems {
  const problems: DraftProblems = {};
  if (draft.name.trim() === "") problems.name = "Escribe un nombre.";
  if (draft.kind === "other" && draft.otherKind.trim() === "") {
    problems.otherKind = "Escribe qué es: un objeto, una facción, una época.";
  }
  if (draft.attributes.some((attribute) => attribute.name.trim() === "")) {
    problems.attributes = "Cada atributo necesita un nombre.";
  }
  return problems;
}

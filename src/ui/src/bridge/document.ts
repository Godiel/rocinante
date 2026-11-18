import type { JSONContent } from "@tiptap/react";
import type { TipTapDocument } from "./generated/protocol";

/**
 * Narrows the editor's loosely typed JSON to the contract's document type.
 * `editor.getJSON()` always returns a `doc` root; anything else is a bug.
 */
export function toTipTapDocument(json: JSONContent): TipTapDocument {
  if (json.type !== "doc") {
    throw new Error(`Expected a TipTap document root, got "${json.type ?? "undefined"}".`);
  }
  return json as TipTapDocument;
}

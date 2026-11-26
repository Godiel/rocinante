import type { TipTapDocument } from "../../bridge/generated/protocol";

/** The content of a note written as plain text: one paragraph per line, blank lines left out. */
export function contentFromText(text: string): TipTapDocument {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return {
    type: "doc",
    content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
  };
}

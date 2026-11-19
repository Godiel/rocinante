import { diffWordsWithSpace } from "diff";

/** The TipTap JSON as the core and the editor share it, read loosely. */
interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  content?: Node[];
}

const BLOCKS = new Set(["paragraph", "heading"]);

/**
 * The text of a document as a reader sees it, one line per paragraph or heading. A scene break
 * becomes «* * *» and a footnote is kept in brackets, so changes to either are seen too.
 */
export function plainText(document: unknown): string {
  const lines: string[] = [];

  const inline = (node: Node): string => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return " ";
    if (node.type === "footnote") return ` [nota al pie: ${String(node.attrs?.text ?? "")}]`;
    return (node.content ?? []).map(inline).join("");
  };

  const walk = (node: Node) => {
    if (node.type && BLOCKS.has(node.type)) {
      lines.push(inline(node));
    } else if (node.type === "sceneBreak") {
      lines.push("* * *");
    } else {
      for (const child of node.content ?? []) walk(child);
    }
  };

  walk(document as Node);
  return lines.join("\n");
}

export interface Piece {
  text: string;
  change: "same" | "added" | "removed";
}

/**
 * What changed from `before` to `after`, word by word, as paragraphs of pieces: the current text
 * with what was added and what was taken out, like pencil corrections on a page.
 */
export function compare(before: string, after: string): Piece[][] {
  const paragraphs: Piece[][] = [[]];
  for (const part of diffWordsWithSpace(before, after)) {
    const change = part.added ? "added" : part.removed ? "removed" : "same";
    part.value.split("\n").forEach((text, index) => {
      if (index > 0) paragraphs.push([]);
      if (text) paragraphs[paragraphs.length - 1]!.push({ text, change });
    });
  }
  return paragraphs;
}

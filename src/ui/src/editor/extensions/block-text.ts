import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * A text block's words as the core reads them, and where each of its characters is in the document. A line
 * break is a `\n`; footnotes and note anchors are not words of the text and are left out.
 */
export function blockText(
  block: ProseMirrorNode,
  start: number,
): { text: string; positions: number[] } {
  let text = "";
  const positions: number[] = [];
  block.forEach((child, offset) => {
    const at = start + 1 + offset;
    if (child.isText) {
      const value = child.text ?? "";
      for (let index = 0; index < value.length; index++) positions.push(at + index);
      text += value;
    } else if (child.type.name === "hardBreak") {
      positions.push(at);
      text += "\n";
    }
  });
  return { text, positions };
}

/** The document range of a stretch of a block's text. */
export function rangeOf(
  positions: readonly number[],
  start: number,
  length: number,
): { from: number; to: number } {
  return { from: positions[start]!, to: positions[start + length - 1]! + 1 };
}

import type { CSSProperties } from "react";
import type { WorkFormat } from "../../bridge/generated/protocol";
import { TYPEFACES } from "../../design/typefaces";

/**
 * On screen the text keeps its comfortable size: the default body of a book, 11 pt, is shown at
 * the 19 px of the writing surface, and other bodies in proportion. The page view uses real points.
 */
const SCREEN_PX_PER_POINT = 19 / 11;

/** The CSS variables and classes that set the text of the continuous paper as the work says. */
export function workStyle(format: WorkFormat): CSSProperties {
  const typeface = TYPEFACES[format.typeface];
  return {
    "--work-font": typeface.family,
    "--work-size": `${(format.bodySize * SCREEN_PX_PER_POINT).toFixed(2)}px`,
    "--work-leading": String(format.leading),
    "--work-char": String(typeface.charWidth),
  } as CSSProperties;
}

export function workClasses(format: WorkFormat): string {
  return [
    format.justified ? "work-justified" : "work-ragged",
    format.firstLineIndent ? "work-indented" : "work-spaced",
    format.dropCap ? "work-drop-cap" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

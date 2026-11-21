import type { Theme } from "../../bridge/generated/protocol";
import { themes } from "../../design/themes";

/**
 * How opaque the paper under the text is when a background shows through it. Each value is the
 * least that keeps ink, soft ink and the rubric at WCAG AA over the worst backgrounds there are,
 * pure white and pure black, plus a margin; the contrast test checks it.
 */
export const SHEET_OPACITY: Record<Theme, number> = {
  paper: 0.88,
  candlelight: 0.95,
};

/** A #RRGGBB colour laid with some opacity over another: what the eye ends up seeing. */
export function blend(top: string, opacity: number, bottom: string): string {
  const channels = (hex: string) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  const below = channels(bottom);
  return `#${channels(top)
    .map((value, index) => Math.round(opacity * value + (1 - opacity) * below[index]!))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The paper of the theme, translucent, as a CSS colour. */
export function sheetColour(theme: Theme): string {
  const paper = themes[theme].paper;
  const [red, green, blue] = [1, 3, 5].map((at) => Number.parseInt(paper.slice(at, at + 2), 16));
  return `rgb(${red} ${green} ${blue} / ${SHEET_OPACITY[theme]})`;
}

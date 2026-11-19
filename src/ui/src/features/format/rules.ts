import type { WorkFormat } from "../../bridge/generated/protocol";
import { shown, type Unit } from "./page-sizes";

/** The same limits as the core (WorkFormat in Rocinante.Domain), so the writer hears of them first. */
export const LIMITS = {
  pageSide: { min: 70, max: 300 },
  textWidth: 40,
  textHeight: 60,
  bodySize: { min: 8, max: 16 },
  leading: { min: 1, max: 2 },
} as const;

export type FormatField =
  | "pageWidth"
  | "pageHeight"
  | "top"
  | "bottom"
  | "inside"
  | "outside"
  | "bodySize"
  | "leading"
  | "margins";

export type Problems = Partial<Record<FormatField, string>>;

/** What is wrong with a format, field by field, in Spanish. Empty when the core will accept it. */
export function problemsOf(format: WorkFormat, unit: Unit): Problems {
  const problems: Problems = {};
  const { min, max } = LIMITS.pageSide;
  const side = `Entre ${shown(min, unit)} y ${shown(max, unit)} ${unit === "cm" ? "cm" : "pulgadas"}.`;
  if (format.pageWidth < min || format.pageWidth > max) problems.pageWidth = side;
  if (format.pageHeight < min || format.pageHeight > max) problems.pageHeight = side;

  for (const margin of ["top", "bottom", "inside", "outside"] as const) {
    if (format.margins[margin] < 0) problems[margin] = "No puede ser negativo.";
  }

  const { margins } = format;
  const width = format.pageWidth - margins.inside - margins.outside;
  const height = format.pageHeight - margins.top - margins.bottom;
  if (
    !problems.pageWidth &&
    !problems.pageHeight &&
    (width < LIMITS.textWidth || height < LIMITS.textHeight)
  ) {
    problems.margins = `Los márgenes no dejan sitio al texto: debe quedar al menos una caja de ${shown(
      LIMITS.textWidth,
      unit,
    )} × ${shown(LIMITS.textHeight, unit)} ${unit === "cm" ? "cm" : "pulgadas"}.`;
  }

  if (format.bodySize < LIMITS.bodySize.min || format.bodySize > LIMITS.bodySize.max) {
    problems.bodySize = "Entre 8 y 16 puntos.";
  }
  if (format.leading < LIMITS.leading.min || format.leading > LIMITS.leading.max) {
    problems.leading = "Entre 1 y 2.";
  }
  return problems;
}

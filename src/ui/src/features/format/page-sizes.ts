import type { PageMargins, PageSize } from "../../bridge/generated/protocol";

export type Unit = "cm" | "in";

export interface PageSizeInfo {
  label: string;
  /** Millimetres, as everything on the page. */
  width: number;
  height: number;
  /** The printer's margins proposed with this size. */
  margins: PageMargins;
  /** The unit this size is usually spoken of in. */
  unit: Unit;
}

/**
 * The page sizes the writer can pick, with the margins a printer would propose for each. The core
 * stores measures, not this catalogue: a work keeps its page if these proposals change one day.
 */
export const PAGE_SIZES: Record<Exclude<PageSize, "custom">, PageSizeInfo> = {
  pocket: {
    label: "Bolsillo (11 × 17 cm)",
    width: 110,
    height: 170,
    margins: { top: 14, bottom: 18, inside: 16, outside: 12 },
    unit: "cm",
  },
  a5: {
    label: "A5 (14,8 × 21 cm)",
    width: 148,
    height: 210,
    margins: { top: 18, bottom: 22, inside: 20, outside: 15 },
    unit: "cm",
  },
  digest: {
    label: "5,5 × 8,5 in",
    width: 139.7,
    height: 215.9,
    margins: { top: 17, bottom: 21, inside: 19, outside: 14 },
    unit: "in",
  },
  trade: {
    label: "6 × 9 in",
    width: 152.4,
    height: 228.6,
    margins: { top: 19, bottom: 23, inside: 22, outside: 16 },
    unit: "in",
  },
  a4: {
    label: "A4 (21 × 29,7 cm)",
    width: 210,
    height: 297,
    margins: { top: 25, bottom: 30, inside: 30, outside: 22 },
    unit: "cm",
  },
  letter: {
    label: "Carta (8,5 × 11 in)",
    width: 215.9,
    height: 279.4,
    margins: { top: 25, bottom: 30, inside: 30, outside: 22 },
    unit: "in",
  },
};

export const PAGE_SIZE_ORDER = Object.keys(PAGE_SIZES) as Exclude<PageSize, "custom">[];

const MM_PER: Record<Unit, number> = { cm: 10, in: 25.4 };

/** A length in millimetres as the writer reads it: «14,8» in cm, «5,5» in inches. */
export function shown(millimetres: number, unit: Unit): string {
  const value = Math.round((millimetres / MM_PER[unit]) * 100) / 100;
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false });
}

/** What the writer typed, in millimetres; null if it is not a number. Accepts «14,8» and «14.8». */
export function typed(text: string, unit: Unit): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * MM_PER[unit] * 100) / 100;
}

/** A plain number the writer typed (points, leading); null if it is not one. */
export function typedNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

export function shownNumber(value: number): string {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2, useGrouping: false });
}

import type { ExportFormat } from "../../bridge/generated/protocol";

export interface FormatInfo {
  id: ExportFormat;
  /** What the writer sees. */
  label: string;
  /** What it is for, in a few words. */
  hint: string;
  extension: string;
  /** The name of the kind of file in the system dialog. */
  kind: string;
}

/** The four formats the work can be exported as, in the order the writer is offered them. */
export const FORMATS: readonly FormatInfo[] = [
  {
    id: "pdf",
    label: "PDF",
    hint: "Para imprimir, con la hoja de la obra.",
    extension: "pdf",
    kind: "Documento PDF",
  },
  {
    id: "epub",
    label: "EPUB",
    hint: "Para lectores de libros electrónicos.",
    extension: "epub",
    kind: "Libro EPUB",
  },
  {
    id: "docx",
    label: "Word",
    hint: "Para una editorial o para otro programa.",
    extension: "docx",
    kind: "Documento de Word",
  },
  {
    id: "md",
    label: "Markdown",
    hint: "El texto limpio, con sus marcas.",
    extension: "md",
    kind: "Texto Markdown",
  },
];

export function formatInfo(id: ExportFormat): FormatInfo {
  return FORMATS.find((format) => format.id === id) ?? FORMATS[0]!;
}

/** A name for the file from the title of the work, without what file systems do not allow. */
export function fileName(title: string, extension: string): string {
  const clean = title.replace(/[\\:*?"<>|/]/g, "").trim();
  return `${clean || "Obra"}.${extension}`;
}

/** The default credits the core writes when the author wrote none. */
export function defaultCredits(author: string, year: number): string {
  return author.trim()
    ? `© ${year} ${author.trim()}. Todos los derechos reservados.`
    : `© ${year}. Todos los derechos reservados.`;
}

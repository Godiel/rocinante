import type { Typeface } from "../bridge/generated/protocol";

export interface TypefaceInfo {
  /** The name the writer sees. */
  label: string;
  /** The CSS font stack, with system fallbacks of the same kind. */
  family: string;
  /** The Fontsource package it comes from, whose licence ships with the app. */
  package: string;
}

/**
 * The typefaces for the text of the work, in the order the writer is offered them. The only list:
 * the format panel, the text and the page view all read it. The fonts themselves are loaded in
 * typefaces.css.
 */
export const TYPEFACES: Record<Typeface, TypefaceInfo> = {
  ebGaramond: {
    label: "EB Garamond",
    family: '"EB Garamond", Garamond, "Times New Roman", serif',
    package: "@fontsource/eb-garamond",
  },
  literata: {
    label: "Literata",
    family: 'Literata, Georgia, "Times New Roman", serif',
    package: "@fontsource/literata",
  },
  crimsonPro: {
    label: "Crimson Pro",
    family: '"Crimson Pro", Garamond, "Times New Roman", serif',
    package: "@fontsource/crimson-pro",
  },
  sourceSerif4: {
    label: "Source Serif 4",
    family: '"Source Serif 4", Georgia, "Times New Roman", serif',
    package: "@fontsource/source-serif-4",
  },
  libreBaskerville: {
    label: "Libre Baskerville",
    family: '"Libre Baskerville", Baskerville, Georgia, serif',
    package: "@fontsource/libre-baskerville",
  },
  courierPrime: {
    label: "Courier Prime",
    family: '"Courier Prime", "Courier New", Courier, monospace',
    package: "@fontsource/courier-prime",
  },
};

export const TYPEFACE_ORDER = Object.keys(TYPEFACES) as Typeface[];

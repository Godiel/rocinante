import type { Theme } from "../bridge/generated/protocol";

/**
 * The colours of each theme: paper and ink, and a single accent, the red of rubrics. Every
 * component uses these through CSS variables (`--color-paper`, `--color-ink`…), never loose hex
 * values. The contrast test reads them from here, so what is checked is what is shown.
 */
export interface Palette {
  /** Background of the writing surface. */
  paper: string;
  /** A shade of the paper, for hovered and selected rows. */
  paperShade: string;
  /** Text of the work and of the interface. */
  ink: string;
  /** Secondary text: dates, labels, the counter. */
  inkSoft: string;
  /** Ornaments, rules and large text only: below 4.5:1, never for body text. */
  inkFaint: string;
  /** Hairlines between rows. */
  rule: string;
  /** The single accent: active element, main action, mentions. Used sparingly. */
  rubric: string;
  /** Background of selected text. */
  selection: string;
}

export const themes: Record<Theme, Palette> = {
  paper: {
    paper: "#F5EFE3",
    paperShade: "#ECE4D4",
    ink: "#2B2620",
    inkSoft: "#4A4239",
    inkFaint: "#766B5E",
    rule: "#D8CEBC",
    rubric: "#9B2C24",
    selection: "#E9D2C6",
  },
  candlelight: {
    paper: "#1E1913",
    paperShade: "#29221A",
    ink: "#E6D9C0",
    inkSoft: "#CFC1A6",
    inkFaint: "#A29479",
    rule: "#3B3227",
    rubric: "#DA7262",
    selection: "#4B2F27",
  },
};

const variable = (name: string) =>
  `--color-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/** The CSS variables of a theme, e.g. `--color-ink-soft`. */
export function cssVariables(theme: Theme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(themes[theme]).map(([name, value]) => [variable(name), value]),
  );
}

/** Paints the whole window with a theme. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(cssVariables(theme))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "candlelight" ? "dark" : "light";
}

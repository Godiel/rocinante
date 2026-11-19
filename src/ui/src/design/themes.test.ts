import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { cssVariables, themes, type Palette } from "./themes";

// The constitution asks for WCAG AA in both themes: 4.5:1 for text, 3:1 for large text and
// graphics. These checks run on the very values the app paints.

const BODY_TEXT = 4.5;
const LARGE_TEXT_AND_GRAPHICS = 3;

const textColours: (keyof Palette)[] = ["ink", "inkSoft", "rubric"];
const backgrounds: (keyof Palette)[] = ["paper", "paperShade"];

describe.each(Object.entries(themes))("theme %s", (_, palette) => {
  it.each(textColours.flatMap((text) => backgrounds.map((background) => [text, background])))(
    "%s on %s reaches AA for body text",
    (text, background) => {
      expect(contrastRatio(palette[text], palette[background])).toBeGreaterThanOrEqual(BODY_TEXT);
    },
  );

  it("selected text stays readable", () => {
    expect(contrastRatio(palette.ink, palette.selection)).toBeGreaterThanOrEqual(BODY_TEXT);
  });

  it("ornaments reach AA for graphics", () => {
    expect(contrastRatio(palette.inkFaint, palette.paper)).toBeGreaterThanOrEqual(
      LARGE_TEXT_AND_GRAPHICS,
    );
  });
});

describe("contrast ratio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("refuses colours it cannot read", () => {
    expect(() => contrastRatio("red", "#FFFFFF")).toThrow("Not a #RRGGBB colour");
  });
});

describe("theme variables", () => {
  it("name every colour as a kebab-case CSS variable", () => {
    expect(cssVariables("paper")).toMatchObject({
      "--color-paper": themes.paper.paper,
      "--color-ink-soft": themes.paper.inkSoft,
      "--color-paper-shade": themes.paper.paperShade,
    });
    expect(Object.keys(cssVariables("candlelight"))).toHaveLength(Object.keys(themes.paper).length);
  });
});

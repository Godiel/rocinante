import { describe, expect, it } from "vitest";
import { caretBox, EYE_LINE, platenScroll } from "./typewriter";

describe("typewriter scrolling", () => {
  const viewport = 1000;
  const eyes = viewport * EYE_LINE;

  it("raises the paper when the line goes below the eyes", () => {
    expect(platenScroll({ top: eyes + 85, bottom: eyes + 115, left: 0 }, viewport)).toBe(100);
  });

  it("lowers it when the line is above, as after going back up", () => {
    expect(platenScroll({ top: eyes - 315, bottom: eyes - 285, left: 0 }, viewport)).toBe(-300);
  });

  it("keeps still for the last pixel or two, so typing along a line never shakes the page", () => {
    expect(platenScroll({ top: eyes - 14, bottom: eyes + 16, left: 0 }, viewport)).toBe(0);
  });

  it("accepts another eye line", () => {
    expect(platenScroll({ top: 485, bottom: 515, left: 0 }, viewport, 0.5)).toBe(0);
  });
});

describe("typewriter caret", () => {
  it("is placed inside its container and as tall as the line", () => {
    const box = caretBox({ top: 230.4, bottom: 260.8, left: 410.6 }, { top: 200, left: 100 });

    expect(box).toEqual({ top: 30, left: 311, height: 30 });
  });

  it("never collapses to nothing", () => {
    expect(caretBox({ top: 10, bottom: 10, left: 0 }, { top: 0, left: 0 }).height).toBe(1);
  });
});

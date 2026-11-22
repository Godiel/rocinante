import { describe, expect, it } from "vitest";
import {
  CANDLE_REACH,
  CLOUD_COUNT,
  RAIN_STREAKS_PER_MEGAPIXEL,
  SCENES,
  candle,
  clouds,
  rain,
  seeded,
  wrap,
  type Scene,
  type Shape,
  type Size,
} from "./scenes";

const window: Size = { width: 1920, height: 1080 };

const xs = (shapes: Shape[]) => shapes.map((shape) => ("x" in shape ? shape.x : shape.x1));
const ys = (shapes: Shape[]) => shapes.map((shape) => ("y" in shape ? shape.y : shape.y1));

describe("the scene helpers", () => {
  it("give the same numbers for the same seed, and others for another", () => {
    const first = Array.from({ length: 5 }, seeded(7));
    expect(Array.from({ length: 5 }, seeded(7))).toEqual(first);
    expect(Array.from({ length: 5 }, seeded(8))).not.toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("wrap around in both directions", () => {
    expect(wrap(25, 10)).toBe(5);
    expect(wrap(-3, 10)).toBe(7);
  });
});

describe.each(Object.entries(SCENES))("the %s scene", (_, each) => {
  const scene = each as Scene<unknown>;
  const layout = scene.lay(window, seeded(1));

  it("is the same scene for the same size and seed", () => {
    expect(scene.lay(window, seeded(1))).toEqual(layout);
  });

  it("depends on the time alone, so it can be drawn for any moment", () => {
    expect(scene.draw(layout, 12.5, window, "paper")).toEqual(
      scene.draw(layout, 12.5, window, "paper"),
    );
    expect(scene.draw(layout, 12.5, window, "paper")).not.toEqual(
      scene.draw(layout, 13, window, "paper"),
    );
  });

  it("keeps drawing after hours, without drifting off the window", () => {
    const late = scene.draw(layout, 6 * 3600 + 0.37, window, "candlelight");
    expect(late.length).toBeGreaterThan(0);
    for (const x of xs(late)) expect(Number.isFinite(x)).toBe(true);
  });
});

describe("rain on the window", () => {
  const layout = rain.lay(window, seeded(1));

  it("has as many streaks as the window is large", () => {
    expect(layout.streaks).toHaveLength(Math.round(RAIN_STREAKS_PER_MEGAPIXEL * 2.0736));
    expect(rain.lay({ width: 960, height: 540 }, seeded(1)).streaks.length).toBeLessThan(
      layout.streaks.length / 3,
    );
  });

  it("falls: each streak is lower a moment later, until it starts again at the top", () => {
    const streak = layout.streaks[0]!;
    const at = (time: number) => (rain.draw(layout, time, window, "paper")[0] as { y1: number }).y1;
    const t = 0.01;
    expect(at(t)).toBeCloseTo(at(0) + streak.speed * t, 5);
    for (const y of ys(rain.draw(layout, 123.4, window, "paper"))) {
      expect(y).toBeGreaterThanOrEqual(-28);
      expect(y).toBeLessThanOrEqual(window.height);
    }
  });

  it("is fainter by night", () => {
    const [day] = rain.draw(layout, 0, window, "paper");
    const [night] = rain.draw(layout, 0, window, "candlelight");
    expect(day).not.toEqual(night);
  });
});

describe("a candle", () => {
  const layout = candle.lay(window, seeded(3));

  it("stands at the side of the page, out of the column of text", () => {
    const [glow] = candle.draw(layout, 0, window, "paper");
    expect(glow?.kind).toBe("glow");
    expect((glow as { x: number }).x).toBeLessThan(window.width * 0.25);
  });

  it("breathes, but never far from its reach", () => {
    const reaches = Array.from({ length: 200 }, (_, at) => {
      const [glow] = candle.draw(layout, at * 0.07, window, "paper");
      return (glow as { radius: number }).radius;
    });
    const reach = window.height * CANDLE_REACH;
    expect(new Set(reaches).size).toBeGreaterThan(100);
    for (const radius of reaches) {
      expect(radius).toBeGreaterThan(reach * 0.95);
      expect(radius).toBeLessThan(reach * 1.05);
    }
  });
});

describe("slow clouds", () => {
  const layout = clouds.lay(window, seeded(5));

  it("cross from left to right, and come back from the left", () => {
    expect(layout.clouds).toHaveLength(CLOUD_COUNT);
    const first = layout.clouds[0]!;
    const x = (time: number) => xs(clouds.draw(layout, time, window, "paper"))[0]!;
    expect(x(1)).toBeGreaterThan(x(0));
    const lap = (window.width + 5 * first.scale) / first.speed;
    expect(x(lap)).toBeCloseTo(x(0), 5);
  });

  it("move slowly: a cloud takes minutes to cross the window", () => {
    for (const cloud of layout.clouds) {
      expect(window.width / cloud.speed).toBeGreaterThan(120);
    }
  });
});

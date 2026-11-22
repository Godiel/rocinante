import type { Theme } from "../../../bridge/generated/protocol";

/**
 * The animated backgrounds, as pure functions: a scene is laid out once for a size and a seed,
 * and from then on what it shows at a moment is computed from that moment alone. Nothing moves
 * by accumulation, so a frame can be drawn for any time, tests need no browser, and a paused
 * scene resumes where the clock says.
 */

/** Something to draw, in CSS pixels of the window. */
export type Shape =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; width: number; colour: string }
  | { kind: "dot"; x: number; y: number; radius: number; colour: string }
  | { kind: "blob"; x: number; y: number; rx: number; ry: number; colour: string }
  | { kind: "glow"; x: number; y: number; radius: number; inner: string; outer: string };

export interface Size {
  width: number;
  height: number;
}

export interface Scene<Layout> {
  /** Places what the scene is made of; the same size and seed give the same layout. */
  lay(size: Size, random: () => number): Layout;
  /** What the scene shows at `time` seconds. */
  draw(layout: Layout, time: number, size: Size, theme: Theme): Shape[];
}

/** A small seeded generator (mulberry32): the same seed, the same scene. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** `value` brought into [0, length), also for negative values. */
export const wrap = (value: number, length: number) => ((value % length) + length) % length;

const between = (random: () => number, low: number, high: number) => low + random() * (high - low);

// Rain on a window: fine streaks falling, and drops on the glass that slide down slowly.

interface Streak {
  x: number;
  start: number;
  speed: number;
  length: number;
}

interface Drop {
  x: number;
  start: number;
  speed: number;
  radius: number;
}

export interface RainLayout {
  streaks: Streak[];
  drops: Drop[];
}

export const RAIN_STREAKS_PER_MEGAPIXEL = 90;
export const RAIN_DROPS_PER_MEGAPIXEL = 40;

export const rain: Scene<RainLayout> = {
  lay({ width, height }, random) {
    const megapixels = (width * height) / 1_000_000;
    return {
      streaks: Array.from({ length: Math.round(RAIN_STREAKS_PER_MEGAPIXEL * megapixels) }, () => ({
        x: random() * width,
        start: random() * height,
        speed: between(random, 500, 900),
        length: between(random, 12, 28),
      })),
      drops: Array.from({ length: Math.round(RAIN_DROPS_PER_MEGAPIXEL * megapixels) }, () => ({
        x: random() * width,
        start: random() * height,
        speed: between(random, 2, 14),
        radius: between(random, 1.2, 3.2),
      })),
    };
  },
  draw({ streaks, drops }, time, { height }, theme) {
    const streak = theme === "paper" ? "rgb(255 255 255 / 0.45)" : "rgb(190 205 220 / 0.22)";
    const drop = theme === "paper" ? "rgb(255 255 255 / 0.55)" : "rgb(190 205 220 / 0.3)";
    // A streak leaves the bottom and comes back at the top, its length out of sight in between.
    const shapes: Shape[] = streaks.map(({ x, start, speed, length }) => {
      const y = wrap(start + speed * time, height + length) - length;
      return {
        kind: "line",
        x1: x,
        y1: y,
        x2: x - length * 0.08,
        y2: y + length,
        width: 1,
        colour: streak,
      };
    });
    for (const { x, start, speed, radius } of drops) {
      shapes.push({ kind: "dot", x, y: wrap(start + speed * time, height), radius, colour: drop });
    }
    return shapes;
  },
};

// A candle at the side of the page: a warm glow that breathes, and a flame that flickers.

export interface CandleLayout {
  /** Phases of the waves that make the flicker, so two candles never flicker alike. */
  phases: [number, number, number];
}

/** How far the light of the candle reaches, as a share of the shorter side of the window. */
export const CANDLE_REACH = 0.45;

export const candle: Scene<CandleLayout> = {
  lay(_, random) {
    return { phases: [random() * 6.28, random() * 6.28, random() * 6.28] };
  },
  draw({ phases: [a, b, c] }, time, { width, height }) {
    // Three slow waves, never in step: the light breathes without a visible period.
    const flicker =
      0.5 * Math.sin(time * 1.7 + a) +
      0.3 * Math.sin(time * 4.3 + b) +
      0.2 * Math.sin(time * 9.1 + c);
    const x = width * 0.14;
    const y = height * 0.72;
    const reach = Math.min(width, height) * CANDLE_REACH * (1 + 0.04 * flicker);
    const lean = 1.5 * Math.sin(time * 2.3 + b);
    return [
      {
        kind: "glow",
        x,
        y,
        radius: reach,
        inner: "rgb(255 190 110 / 0.30)",
        outer: "rgb(255 160 80 / 0)",
      },
      {
        kind: "glow",
        x,
        y: y - 14,
        radius: 26 + 2 * flicker,
        inner: "rgb(255 230 170 / 0.9)",
        outer: "rgb(255 200 120 / 0)",
      },
      {
        kind: "blob",
        x: x + lean,
        y: y - 16,
        rx: 5,
        ry: 14 + 1.5 * flicker,
        colour: "rgb(255 236 190 / 0.95)",
      },
      {
        kind: "line",
        x1: x,
        y1: y - 2,
        x2: x,
        y2: y + 70,
        width: 16,
        colour: "rgb(235 225 205 / 0.85)",
      },
    ];
  },
};

// Slow clouds: soft groups of blobs that cross the sky from left to right.

interface Cloud {
  start: number;
  y: number;
  speed: number;
  scale: number;
  /** The blobs of the cloud, relative to its centre, in units of its scale. */
  puffs: { dx: number; dy: number; r: number }[];
}

export interface CloudsLayout {
  clouds: Cloud[];
}

export const CLOUD_COUNT = 9;

export const clouds: Scene<CloudsLayout> = {
  lay({ width, height }, random) {
    return {
      clouds: Array.from({ length: CLOUD_COUNT }, () => ({
        start: random() * width,
        y: between(random, 0.05, 0.9) * height,
        speed: between(random, 4, 12),
        scale: between(random, 50, 120),
        puffs: Array.from({ length: 5 }, (_, at) => ({
          dx: (at - 2) * 0.7 + between(random, -0.2, 0.2),
          dy: between(random, -0.25, 0.25),
          r: between(random, 0.6, 1),
        })),
      })),
    };
  },
  draw({ clouds: all }, time, { width }, theme) {
    // Soft puffs that fade at their edges: overlapping, they make one cloud, not a pile of discs.
    const inner = theme === "paper" ? "rgb(255 255 255 / 0.5)" : "rgb(120 130 150 / 0.14)";
    const outer = theme === "paper" ? "rgb(255 255 255 / 0)" : "rgb(120 130 150 / 0)";
    const shapes: Shape[] = [];
    for (const { start, y, speed, scale, puffs } of all) {
      // A cloud leaves on the right and comes back from the left, wholly out of sight between.
      const margin = scale * 2.5;
      const x = wrap(start + speed * time, width + 2 * margin) - margin;
      for (const { dx, dy, r } of puffs) {
        shapes.push({
          kind: "glow",
          x: x + dx * scale,
          y: y + dy * scale,
          radius: r * scale * 1.3,
          inner,
          outer,
        });
      }
    }
    return shapes;
  },
};

export const SCENES = { rain, candle, clouds } as const;

export type SceneName = keyof typeof SCENES;

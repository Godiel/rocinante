import { useEffect, useRef } from "react";
import type { Theme } from "../../../bridge/generated/protocol";
import { draw } from "./draw";
import { SCENES, seeded, type SceneName, type Size } from "./scenes";

/** At most this many frames a second: slow things need no more, and the text needs the rest. */
export const MAX_FPS = 30;
/** Sharper than this is not worth the work behind a sheet of paper. */
const MAX_PIXEL_RATIO = 1.5;

interface AnimatedBackdropProps {
  scene: SceneName;
  theme: Theme;
}

/**
 * Draws a scene on a canvas behind everything. It pauses while the window is hidden and, if the
 * system asks for less motion, stays on its first frame.
 */
export function AnimatedBackdrop({ scene, theme }: AnimatedBackdropProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    const definition = SCENES[scene] as (typeof SCENES)["rain"];
    let size: Size = { width: 0, height: 0 };
    let layout = definition.lay(size, seeded(1));
    let frame = 0;
    let last = -Infinity;
    const started = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paint = (time: number) => {
      context.clearRect(0, 0, size.width, size.height);
      for (const shape of definition.draw(layout, time, size, theme)) draw(context, shape);
    };

    const fit = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      size = { width: window.innerWidth, height: window.innerHeight };
      element.width = Math.round(size.width * ratio);
      element.height = Math.round(size.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // The same seed: a new size spreads the same scene, it does not shuffle it.
      layout = definition.lay(size, seeded(1));
      paint(still.matches ? 0 : (performance.now() - started) / 1000);
    };

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (now - last < 1000 / MAX_FPS - 1) return;
      last = now;
      paint((now - started) / 1000);
    };

    const run = () => {
      window.cancelAnimationFrame(frame);
      if (!still.matches && !document.hidden) frame = window.requestAnimationFrame(tick);
      else if (still.matches) paint(0);
    };

    fit();
    run();
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", run);
    still.addEventListener("change", run);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
      document.removeEventListener("visibilitychange", run);
      still.removeEventListener("change", run);
    };
  }, [scene, theme]);

  return (
    <canvas ref={canvas} className="focus-backdrop focus-backdrop-animated" aria-hidden="true" />
  );
}

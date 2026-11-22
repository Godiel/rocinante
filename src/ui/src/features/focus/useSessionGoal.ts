import { useEffect, useState } from "react";
import type { SessionGoal } from "../../bridge/generated/protocol";

/** How often the minutes are counted. */
export const TICK_MS = 1000;

/** A session of focus mode: it starts when the mode does and ends with it. Nothing is kept. */
export interface Session {
  /** Words of the work when it started. */
  words: number;
}

export interface GoalProgress {
  /** What has been done in the session: new words, or whole minutes. */
  done: number;
  target: number;
  kind: "words" | "minutes";
  reached: boolean;
}

export interface Clock {
  now(): number;
  every(run: () => void, milliseconds: number): () => void;
  visible(): boolean;
}

const realClock: Clock = {
  now: () => performance.now(),
  every: (run, milliseconds) => {
    const handle = window.setInterval(run, milliseconds);
    return () => window.clearInterval(handle);
  },
  visible: () => document.visibilityState === "visible",
};

/**
 * How the session goes against its goal. New words are counted from the words of the work when
 * the session started and never go below zero, so erasing is not punished; minutes count only
 * while the window is in sight.
 */
export function useSessionGoal(
  session: Session | null,
  goal: SessionGoal,
  words: number,
  clock: Clock = realClock,
): GoalProgress | null {
  // Seconds in sight, of the session they were counted in.
  const [counted, setCounted] = useState<{ session: Session; seconds: number } | null>(null);

  useEffect(() => {
    if (!session) return;
    let last = clock.now();
    return clock.every(() => {
      const now = clock.now();
      const elapsed = clock.visible() ? (now - last) / 1000 : 0;
      last = now;
      setCounted((before) => ({
        session,
        seconds: (before?.session === session ? before.seconds : 0) + elapsed,
      }));
    }, TICK_MS);
  }, [session, clock]);

  if (!session || goal.kind === "none") return null;
  const seconds = counted?.session === session ? counted.seconds : 0;
  const done =
    goal.kind === "words" ? Math.max(0, words - session.words) : Math.floor(seconds / 60);
  return { done, target: goal.amount, kind: goal.kind, reached: done >= goal.amount };
}

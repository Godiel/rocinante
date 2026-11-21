// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionGoal } from "../../bridge/generated/protocol";
import { bookExtensions } from "../../editor/extensions";
import { CURRENT_BLOCK, CurrentBlock } from "../../editor/extensions/current-block";
import { GoalMeter, GoalReached, NOTICE_MS } from "./Goal";
import { TICK_MS, useSessionGoal, type Clock, type Session } from "./useSessionGoal";

afterEach(cleanup);

describe("the current block", () => {
  it("marks only the paragraph of the cursor, and follows it", () => {
    const editor = new Editor({
      extensions: [...bookExtensions(), CurrentBlock],
      content:
        "<p>En un lugar</p><p>de la Mancha</p><blockquote><p>de cuyo nombre</p></blockquote>",
    });
    const marked = () =>
      [...editor.view.dom.children]
        .filter((block) => block.classList.contains(CURRENT_BLOCK))
        .map((block) => block.textContent);

    editor.commands.setTextSelection(3);
    expect(marked()).toEqual(["En un lugar"]);

    editor.commands.setTextSelection(17);
    expect(marked()).toEqual(["de la Mancha"]);

    editor.commands.setTextSelection(32);
    expect(marked()).toEqual(["de cuyo nombre"]);
    expect(editor.getHTML()).not.toContain(CURRENT_BLOCK);
    editor.destroy();
  });
});

/** A clock the test moves, with the window in sight or not. */
function fakeClock() {
  let time = 0;
  let inSight = true;
  const ticks = new Set<() => void>();
  const clock: Clock = {
    now: () => time,
    every: (run) => {
      ticks.add(run);
      return () => ticks.delete(run);
    },
    visible: () => inSight,
  };
  return {
    clock,
    /** Lets `seconds` go by, a tick at a time. */
    pass(seconds: number) {
      for (let at = 0; at < (seconds * 1000) / TICK_MS; at++) {
        time += TICK_MS;
        act(() => ticks.forEach((tick) => tick()));
      }
    },
    hide: (hidden: boolean) => void (inSight = !hidden),
  };
}

const words = (amount: number): SessionGoal => ({ kind: "words", amount });
const minutes = (amount: number): SessionGoal => ({ kind: "minutes", amount });

describe("the session goal", () => {
  it("counts the new words of the session, and never below zero", () => {
    const session: Session = { words: 1000 };
    const { result, rerender } = renderHook(
      ({ count }) => useSessionGoal(session, words(500), count, fakeClock().clock),
      { initialProps: { count: 1000 } },
    );
    expect(result.current).toEqual({ done: 0, target: 500, kind: "words", reached: false });

    rerender({ count: 1320 });
    expect(result.current?.done).toBe(320);

    rerender({ count: 900 });
    expect(result.current?.done).toBe(0);

    rerender({ count: 1500 });
    expect(result.current?.reached).toBe(true);
  });

  it("counts whole minutes, only while the window is in sight", () => {
    const time = fakeClock();
    const session: Session = { words: 0 };
    const { result } = renderHook(() => useSessionGoal(session, minutes(5), 0, time.clock));

    time.pass(119);
    expect(result.current?.done).toBe(1);

    time.hide(true);
    time.pass(600);
    expect(result.current?.done).toBe(1);

    time.hide(false);
    time.pass(181);
    expect(result.current).toEqual({ done: 5, target: 5, kind: "minutes", reached: true });
  });

  it("starts again with every session, and is nothing without a goal or out of focus mode", () => {
    const time = fakeClock();
    const { result, rerender } = renderHook(
      ({ session, goal }: { session: Session | null; goal: SessionGoal }) =>
        useSessionGoal(session, goal, 0, time.clock),
      { initialProps: { session: { words: 0 } as Session | null, goal: minutes(5) } },
    );
    time.pass(120);
    expect(result.current?.done).toBe(2);

    rerender({ session: { words: 0 }, goal: minutes(5) });
    expect(result.current?.done).toBe(0);

    rerender({ session: { words: 0 }, goal: { kind: "none" } });
    expect(result.current).toBeNull();

    rerender({ session: null, goal: minutes(5) });
    expect(result.current).toBeNull();
  });
});

describe("the goal on screen", () => {
  it("shows how far the session has come", () => {
    render(<GoalMeter progress={{ done: 1320, target: 2000, kind: "words", reached: false }} />);

    const meter = screen.getByRole("meter", { name: "Meta de la sesión" });
    expect(meter).toHaveTextContent("1.320 / 2.000 palabras");
    expect(meter).toHaveAttribute("aria-valuetext", "1.320 de 2.000 palabras");
  });

  it("says once, quietly, that the goal was reached, and goes away by itself", () => {
    vi.useFakeTimers();
    try {
      const session: Session = { words: 0 };
      const reached = { done: 45, target: 45, kind: "minutes" as const, reached: true };
      const { rerender } = render(
        <GoalReached session={session} progress={{ ...reached, done: 44, reached: false }} />,
      );
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      rerender(<GoalReached session={session} progress={reached} />);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Meta cumplida: 45 minutos de escritura.",
      );

      act(() => void vi.advanceTimersByTime(NOTICE_MS));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      rerender(<GoalReached session={session} progress={{ ...reached, done: 46 }} />);
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      rerender(<GoalReached session={{ words: 0 }} progress={reached} />);
      expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });
});

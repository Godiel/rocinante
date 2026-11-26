// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isBoardWindow, useBoardWindow, useDetachedBoard } from "./board-window";

describe("the board in a window of its own", () => {
  it("knows its window by the label", () => {
    expect(isBoardWindow("board-3")).toBe(true);
    expect(isBoardWindow("window-1")).toBe(false);
    expect(isBoardWindow("main")).toBe(false);
  });

  it("tells the window of the work it is open, and goes home when docked", async () => {
    const onDocked = vi.fn();
    const work = renderHook(() => useDetachedBoard(onDocked));
    const close = vi.fn();
    const board = renderHook(() => useBoardWindow("board-1", close));

    await waitFor(() => expect(work.result.current.detached).toBe(true));

    act(() => board.result.current.dock());
    expect(close).toHaveBeenCalled();
    await waitFor(() => expect(work.result.current.detached).toBe(false));
    expect(onDocked).toHaveBeenCalled();
    board.unmount();
    work.unmount();
  });

  it("closes when the window of the work brings it back, and says so when asked", async () => {
    const close = vi.fn();
    const board = renderHook(() => useBoardWindow("board-2", close));
    const onDocked = vi.fn();
    // A window of the work that opens later asks, and hears the board is out.
    const work = renderHook(() => useDetachedBoard(onDocked));
    await waitFor(() => expect(work.result.current.detached).toBe(true));

    act(() => work.result.current.bringBack());

    await waitFor(() => expect(close).toHaveBeenCalled());
    await waitFor(() => expect(onDocked).toHaveBeenCalled());
    board.unmount();
    work.unmount();
  });
});

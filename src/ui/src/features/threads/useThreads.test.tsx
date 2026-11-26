// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Threads } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { THREADS_AHEAD_MS, useThreads } from "./useThreads";

const threads: Threads = { chosen: [], chapters: [], threads: [], meetings: [], milestones: [] };

beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset();
  request.mockResolvedValue(threads);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the threads of the open work", () => {
  it("are asked for ahead once the writer pauses, and again on coming to them", async () => {
    const { result, rerender } = renderHook(({ active }) => useThreads("obra", active), {
      initialProps: { active: false },
    });
    expect(request).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(THREADS_AHEAD_MS));
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual(threads);

    rerender({ active: true });
    // What was known shows at once, while the core is asked again.
    expect(result.current).toEqual(threads);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(request).toHaveBeenCalledTimes(2);

    rerender({ active: false });
    await act(() => vi.advanceTimersByTimeAsync(THREADS_AHEAD_MS * 2));
    expect(request).toHaveBeenCalledTimes(2);
  });
});

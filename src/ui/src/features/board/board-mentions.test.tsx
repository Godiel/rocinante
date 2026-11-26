// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: (method: string, handler: () => void) => {
    listeners.set(method, handler);
    return Promise.resolve(() => listeners.delete(method));
  },
}));

import { mentionsLine, useBoardMentions } from "./board-mentions";

beforeEach(() => {
  request.mockReset();
  listeners.clear();
});

describe("the mentions of the cards", () => {
  it("says how many times and in how many chapters", () => {
    expect(mentionsLine({ total: 12, chapters: 3 })).toBe("12 menciones · 3 capítulos");
    expect(mentionsLine({ total: 1, chapters: 1 })).toBe("1 mención · 1 capítulo");
    expect(mentionsLine({ total: 0, chapters: 0 })).toBe("Sin menciones");
    expect(mentionsLine(undefined)).toBeNull();
  });

  it("asks the core, and again after a pause when the text or the fichas change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    request.mockResolvedValue({ elements: [{ id: "s", total: 2, chapters: 1 }] });
    const { result } = renderHook(() => useBoardMentions());

    await waitFor(() => expect(result.current.get("s")).toEqual({ total: 2, chapters: 1 }));
    request.mockResolvedValue({ elements: [{ id: "s", total: 3, chapters: 2 }] });
    act(() => listeners.get("document.changed")?.());
    act(() => listeners.get("elements.changed")?.());
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.get("s")).toEqual({ total: 3, chapters: 2 });
    vi.useRealTimers();
  });
});

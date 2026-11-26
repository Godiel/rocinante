// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => new Map<string, (params: unknown) => void>());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: (method: string, handler: (params: unknown) => void) => {
    listeners.set(method, handler);
    return Promise.resolve(() => listeners.delete(method));
  },
}));

import { NO_SQUIRE, useSquire } from "./useSquire";

function proposal(id: string, minute: number): Proposal {
  return {
    id,
    kind: "element",
    documentId: "d",
    passage: "Llegó Claudio.",
    createdAt: `2026-11-26T10:${String(minute).padStart(2, "0")}:00.000Z`,
    element: { name: id, kind: "character", otherKind: null },
    relationship: null,
    attribute: null,
    milestone: null,
  };
}

beforeEach(() => {
  request.mockReset();
  listeners.clear();
});

describe("useSquire", () => {
  it("loads the settings and the proposals, the most recent first, and follows the changes", async () => {
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "squire.settings" ? NO_SQUIRE : [proposal("a", 1), proposal("b", 2)],
      ),
    );
    const { result } = renderHook(() => useSquire("work"));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.proposals.map((shown) => shown.id)).toEqual(["b", "a"]);

    act(() =>
      listeners.get("squire.changed")?.({
        settings: { ...NO_SQUIRE, pending: 2 },
        proposals: [proposal("c", 3)],
        removed: ["a"],
        origin: "squire",
      }),
    );
    expect(result.current.proposals.map((shown) => shown.id)).toEqual(["c", "b"]);
    expect(result.current.settings.pending).toBe(2);
  });
});

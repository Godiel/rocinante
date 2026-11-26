// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../bridge/generated/protocol";
import { contentFromText } from "./content";

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

import { useWorkNotes } from "./useWorkNotes";

function note(id: string, text: string): Note {
  return {
    id,
    documentId: null,
    content: contentFromText(text),
    text,
    anchored: false,
    order: null,
    resolvedAt: null,
    elements: [],
    createdAt: "2026-11-26T10:00:00.000Z",
    updatedAt: "2026-11-26T10:00:00.000Z",
  };
}

function announce(notes: Note[], removed: string[] = []) {
  act(() => listeners.get("notes.changed")?.({ notes, removed, origin: "window-1" }));
}

beforeEach(() => {
  request.mockReset();
  listeners.clear();
});

describe("useWorkNotes", () => {
  it("loads the notes of the work and follows what other windows change", async () => {
    request.mockResolvedValue([note("a", "Revisar esta fecha")]);
    const { result } = renderHook(() => useWorkNotes("work-1"));
    expect(result.current.loaded).toBe(false);

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(request).toHaveBeenCalledWith("notes.get");
    expect(result.current.notes.map((shown) => shown.text)).toEqual(["Revisar esta fecha"]);

    announce([note("b", "Un final en el Toboso")], ["a"]);
    expect(result.current.notes.map((shown) => shown.text)).toEqual(["Un final en el Toboso"]);
  });

  it("keeps a change that arrives before the notes themselves", async () => {
    let answer: (notes: Note[]) => void = () => {};
    request.mockReturnValue(new Promise<Note[]>((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useWorkNotes("work-1"));
    await waitFor(() => expect(listeners.has("notes.changed")).toBe(true));

    announce([note("b", "Llegó antes")]);
    await act(async () => answer([note("a", "Revisar esta fecha")]));

    expect(result.current.notes.map((shown) => shown.id)).toEqual(["a", "b"]);
  });

  it("starts empty for another work", async () => {
    request.mockResolvedValue([note("a", "De la primera obra")]);
    const { result, rerender } = renderHook(({ work }) => useWorkNotes(work), {
      initialProps: { work: "work-1" },
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    request.mockReturnValue(new Promise(() => {}));
    rerender({ work: "work-2" });

    expect(result.current).toEqual({ notes: [], loaded: false });
  });
});

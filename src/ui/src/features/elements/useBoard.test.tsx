// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Element, ElementSummary } from "../../bridge/generated/protocol";
import type { ElementsChange } from "./board-state";

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

import { forgetImages, imageUrl, useElementImage } from "./images";
import { useBoard, useElement } from "./useBoard";

const summary: ElementSummary = {
  id: "q",
  kind: "character",
  otherKind: null,
  name: "Don Quijote",
  aliases: [],
  position: { x: 0, y: 0 },
  image: null,
};
const whole: Element = { ...summary, attributes: [], description: { type: "doc", content: [] } };
const empty: Board = { elements: [], relationships: [], ownKinds: [], trash: [] };

function announce(parts: Partial<ElementsChange>) {
  act(() =>
    listeners.get("elements.changed")?.({
      elements: [],
      trash: [],
      details: [],
      relationships: [],
      removedRelationships: [],
      ownKinds: [],
      origin: "window-1",
      ...parts,
    }),
  );
}

beforeEach(() => {
  request.mockReset();
  listeners.clear();
  forgetImages();
});

afterEach(() => vi.useRealTimers());

describe("useBoard", () => {
  it("loads the board of the work and follows what other windows change", async () => {
    request.mockResolvedValue(empty);
    const { result } = renderHook(() => useBoard("work-1"));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(request).toHaveBeenCalledWith("board.get");

    announce({ elements: [summary] });
    expect(result.current.board.elements).toEqual([summary]);
  });

  it("keeps changes that arrive before the board", async () => {
    let answer: (board: Board) => void = () => {};
    request.mockReturnValue(new Promise<Board>((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useBoard("work-1"));

    await waitFor(() => expect(listeners.has("elements.changed")).toBe(true));
    announce({ elements: [summary] });
    act(() => answer(empty));

    await waitFor(() => expect(result.current.board.elements).toEqual([summary]));
  });

  it("starts empty for another work until its board arrives", async () => {
    request.mockResolvedValue({ ...empty, elements: [summary] });
    const { result, rerender } = renderHook(({ work }) => useBoard(work), {
      initialProps: { work: "work-1" },
    });
    await waitFor(() => expect(result.current.board.elements).toHaveLength(1));

    request.mockReturnValue(new Promise(() => {}));
    rerender({ work: "work-2" });

    expect(result.current).toEqual({ board: empty, loaded: false });
  });
});

describe("useElement", () => {
  it("loads one element and takes it whole from the changes of any window", async () => {
    request.mockResolvedValue(whole);
    const { result } = renderHook(() => useElement("q"));
    await waitFor(() => expect(result.current).toEqual(whole));

    announce({ details: [{ ...whole, name: "Alonso Quijano" }] });
    expect(result.current?.name).toBe("Alonso Quijano");

    announce({ elements: [{ ...summary, name: "Alonso Quijano", position: { x: 40, y: 0 } }] });
    expect(result.current?.position).toEqual({ x: 40, y: 0 });
    expect(result.current?.attributes).toEqual([]);
  });

  it("is null when the element is not there", async () => {
    request.mockRejectedValue(new Error("not there"));
    const { result } = renderHook(() => useElement("lost"));

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

describe("element images", () => {
  it("are asked for once per id, version and size", async () => {
    request.mockResolvedValue({ data: "AAEC", mediaType: "image/webp" });

    const first = await imageUrl("q", 1, "thumbnail");
    await imageUrl("q", 1, "thumbnail");
    await imageUrl("q", 2, "thumbnail");

    expect(first).toBe("data:image/webp;base64,AAEC");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("are asked for again after a failure", async () => {
    request
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValue({ data: "AA==", mediaType: "image/jpeg" });

    await expect(imageUrl("q", 1, "full")).rejects.toThrow("busy");
    await expect(imageUrl("q", 1, "full")).resolves.toBe("data:image/jpeg;base64,AA==");
  });

  it("show nothing for an element without an image", () => {
    const { result } = renderHook(() => useElementImage("q", null, "thumbnail"));

    expect(result.current).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("show the image once it arrives", async () => {
    request.mockResolvedValue({ data: "AAEC", mediaType: "image/webp" });
    const { result } = renderHook(() => useElementImage("q", { version: 3 }, "thumbnail"));

    await waitFor(() => expect(result.current).toBe("data:image/webp;base64,AAEC"));
  });
});

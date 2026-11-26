// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { useNoteTrash } from "./useNoteTrash";

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(null);
});

afterEach(cleanup);

describe("deleting a note", () => {
  it("sets it aside with a notice, and the notice brings it back", async () => {
    const onProblem = vi.fn();
    const { result } = renderHook(() => useNoteTrash("main", onProblem));

    await act(() => result.current.remove("n1"));
    expect(request).toHaveBeenCalledWith("note.delete", { id: "n1", origin: "main" });

    render(<>{result.current.notice}</>);
    expect(screen.getByText("La nota se borró.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Deshacer" }));

    expect(request).toHaveBeenLastCalledWith("note.restore", { id: "n1", origin: "main" });
    expect(result.current.notice).toBeNull();
  });

  it("says what went wrong", async () => {
    request.mockRejectedValue(new Error("sin núcleo"));
    const onProblem = vi.fn();
    const { result } = renderHook(() => useNoteTrash("main", onProblem));

    await act(() => result.current.remove("n1"));

    expect(onProblem).toHaveBeenLastCalledWith(expect.any(String));
    expect(result.current.notice).toBeNull();
  });
});

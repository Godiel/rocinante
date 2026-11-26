// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementReferences } from "../../bridge/generated/protocol";

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

import { ElementMentions } from "./ElementMentions";

const documents = [
  { id: "d1", title: "Los molinos" },
  { id: "d2", title: "La venta" },
];

const references: ElementReferences = {
  total: 3,
  chapters: 2,
  first: { documentId: "d1", ordinal: 0 },
  together: [],
  documents: [
    {
      documentId: "d1",
      mentions: [
        { ordinal: 0, before: "Y ", text: "Sancho", after: " comía." },
        { ordinal: 1, before: "Luego ", text: "Sancho", after: " durmió." },
      ],
    },
    { documentId: "d2", mentions: [{ ordinal: 0, before: "", text: "Sancho", after: " bebió." }] },
  ],
};

beforeEach(() => {
  request.mockReset();
  listeners.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("«En el texto»", () => {
  it("says how many mentions, in how many chapters, and the first", async () => {
    request.mockResolvedValue(references);
    render(<ElementMentions elementId="s" documents={documents} onGoTo={vi.fn()} />);

    expect(await screen.findByText("3 menciones en 2 capítulos.")).toBeInTheDocument();
    expect(screen.getByText(/Primera aparición/)).toHaveTextContent("Los molinos");
    expect(screen.getByRole("heading", { name: "Los molinos (2)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "La venta (1)" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("element.references", { id: "s" });
  });

  it("takes the text to a mention and to the first one", async () => {
    const user = userEvent.setup();
    const onGoTo = vi.fn();
    request.mockResolvedValue(references);
    render(<ElementMentions elementId="s" documents={documents} onGoTo={onGoTo} />);

    await user.click(await screen.findByRole("button", { name: "Luego Sancho durmió." }));
    expect(onGoTo).toHaveBeenLastCalledWith("d1", 1);
    await user.click(screen.getByRole("button", { name: "Los molinos" }));
    expect(onGoTo).toHaveBeenLastCalledWith("d1", 0);
  });

  it("says when the ficha is not in the text yet", async () => {
    request.mockResolvedValue({ total: 0, chapters: 0, first: null, documents: [], together: [] });
    render(<ElementMentions elementId="s" documents={documents} onGoTo={vi.fn()} />);

    expect(await screen.findByText("Aún no aparece en el texto.")).toBeInTheDocument();
  });

  it("asks again, after a pause, when the text or the fichas change", async () => {
    vi.useFakeTimers();
    request.mockResolvedValue(references);
    render(<ElementMentions elementId="s" documents={documents} onGoTo={vi.fn()} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(request).toHaveBeenCalledTimes(1);

    act(() => listeners.get("document.changed")?.());
    act(() => listeners.get("elements.changed")?.());
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(request).toHaveBeenCalledTimes(2);
  });
});

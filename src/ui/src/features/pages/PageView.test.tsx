// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Manuscript, WorkFormat } from "../../bridge/generated/protocol";

const request = vi.fn();
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
}));
const savePendingNow = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../../editor/pending-saves", () => ({ savePendingNow }));

import { CoreError } from "../../bridge/core";
import { isPageViewShortcut } from "./shortcuts";
import { PageView } from "./PageView";

const novel: WorkFormat = {
  pageSize: "a5",
  pageWidth: 148,
  pageHeight: 210,
  margins: { top: 18, bottom: 22, inside: 20, outside: 15 },
  typeface: "ebGaramond",
  bodySize: 11,
  leading: 1.35,
  firstLineIndent: true,
  justified: true,
  dropCap: false,
};

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

const manuscript: Manuscript = {
  chapters: [
    {
      id: "uno",
      title: "Capítulo primero",
      content: { type: "doc", content: [paragraph("En un lugar")] },
    },
    {
      id: "dos",
      title: "Capítulo segundo",
      content: { type: "doc", content: [paragraph("Rocinante")] },
    },
  ],
};

function renderView() {
  const handlers = { onClose: vi.fn(), onProblem: vi.fn() };
  render(<PageView format={novel} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
}

describe("page view", () => {
  beforeAll(() => {
    // jsdom lays nothing out: every block measures nothing, so each chapter fills one page.
    globalThis.ResizeObserver = class {
      readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(manuscript);
    savePendingNow.mockClear();
  });

  afterEach(() => cleanup());

  it("saves what is pending, then sets the book from the text as saved", async () => {
    renderView();

    expect(screen.getByText("Componiendo las páginas…")).toBeInTheDocument();
    expect(await screen.findByText("2 páginas")).toBeInTheDocument();
    expect(savePendingNow).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("project.manuscript");
  });

  it("shows the pages of the book, each chapter on its own, with its title", async () => {
    renderView();

    expect(await screen.findByRole("img", { name: "Página 1" })).toHaveTextContent(
      "Capítulo primeroEn un lugar",
    );
    expect(screen.getByRole("img", { name: "Página 2" })).toHaveTextContent("Capítulo segundo");
  });

  it("nothing on the pages can be written in", async () => {
    renderView();

    const page = await screen.findByRole("img", { name: "Página 1" });
    expect(page.querySelector("[contenteditable]")).toBeNull();
    expect(page.querySelector("input, textarea")).toBeNull();
  });

  it("shows one page or two facing", async () => {
    const { user } = renderView();
    await screen.findByText("2 páginas");

    const two = screen.getByRole("button", { name: "Dos páginas" });
    await user.click(two);
    expect(two).toHaveAttribute("aria-pressed", "true");
    await user.click(two);
    expect(two).toHaveAttribute("aria-pressed", "false");
  });

  it("closes with Escape and with its button", async () => {
    const { onClose, user } = renderView();
    await screen.findByText("2 páginas");

    fireEvent.keyDown(screen.getByRole("region", { name: "Vista de página" }), { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("says in Spanish when the book cannot be read", async () => {
    request.mockRejectedValue(new CoreError(-32001, "No project", "projectNotOpen"));
    const { onProblem } = renderView();

    await act(async () => {});

    expect(onProblem).toHaveBeenCalledWith(expect.stringMatching(/proyecto/i));
  });
});

describe("page view shortcut", () => {
  it("is F5 alone", () => {
    expect(isPageViewShortcut(new KeyboardEvent("keydown", { key: "F5" }))).toBe(true);
    expect(isPageViewShortcut(new KeyboardEvent("keydown", { key: "F5", ctrlKey: true }))).toBe(
      false,
    );
    expect(isPageViewShortcut(new KeyboardEvent("keydown", { key: "F6" }))).toBe(false);
  });
});

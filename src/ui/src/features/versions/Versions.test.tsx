// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TipTapDocument, VersionSummary } from "../../bridge/generated/protocol";

const request = vi.fn();
const listeners = new Map<string, (params: unknown) => void>();
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
  onNotification: (method: string, handler: (params: unknown) => void) => {
    listeners.set(method, handler);
    return Promise.resolve(() => listeners.delete(method));
  },
}));

import { Versions, type VersionsProps } from "./Versions";
import { VersionView } from "./VersionView";

const now = new Date().toISOString();
const version = (id: string, kind: VersionSummary["kind"], name: string | null, words: number) =>
  ({
    id,
    documentId: "d1",
    kind,
    name,
    createdAt: now,
    statistics: { words, characters: words * 5, paragraphs: 1 },
  }) satisfies VersionSummary;

const list = [
  version("v3", "beforeRestore", null, 12),
  version("v2", "manual", "Antes de la batalla", 1),
  version("v1", "automatic", null, 9),
];

function renderVersions(overrides: Partial<VersionsProps> = {}) {
  const props: VersionsProps = {
    documentId: "d1",
    title: "Los molinos de viento",
    origin: "main",
    selectedId: null,
    nameRequest: 0,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onProblem: vi.fn(),
    ...overrides,
  };
  const view = render(<Versions {...props} />);
  return { ...props, view, user: userEvent.setup() };
}

describe("the versions of a document", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation((method: string) =>
      Promise.resolve(method === "version.list" ? list : version("v4", "manual", "Revisado", 12)),
    );
  });

  afterEach(() => {
    cleanup();
    listeners.clear();
  });

  it("lists them newest first, saying what each one is", async () => {
    renderVersions();

    const entries = await screen.findAllByRole("button", { pressed: false });
    expect(entries.map((entry) => entry.textContent)).toEqual([
      expect.stringMatching(/^Antes de restaurarhoy, \d\d:\d\d · 12 palabras$/),
      expect.stringMatching(/^Antes de la batallahoy, .* · 1 palabra$/),
      expect.stringMatching(/^Automática/),
    ]);
    expect(request).toHaveBeenCalledWith("version.list", { documentId: "d1" });
  });

  it("opens the one chosen", async () => {
    const { onSelect, user } = renderVersions();

    await user.click(await screen.findByRole("button", { name: /Antes de la batalla/ }));

    expect(onSelect).toHaveBeenCalledWith(list[1]);
  });

  it("keeps a version with a name, or without one", async () => {
    const { user } = renderVersions();

    await user.type(screen.getByRole("textbox", { name: "Guardar versión" }), " Revisado {Enter}");
    expect(request).toHaveBeenCalledWith("version.create", {
      documentId: "d1",
      name: "Revisado",
      origin: "main",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Guardada: Revisado.");

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(request).toHaveBeenLastCalledWith("version.create", {
      documentId: "d1",
      name: null,
      origin: "main",
    });
  });

  it("takes the keyboard to the name when the writer presses Ctrl+S", () => {
    const { view, ...props } = renderVersions();
    view.rerender(<Versions {...props} nameRequest={1} />);

    expect(screen.getByRole("textbox", { name: "Guardar versión" })).toHaveFocus();
  });

  it("reloads when a version is added in any window", async () => {
    renderVersions();
    await screen.findAllByRole("button", { pressed: false });
    request.mockClear();

    listeners.get("versions.changed")?.({ documentId: "d1", origin: "window-2" });

    expect(request).toHaveBeenCalledWith("version.list", { documentId: "d1" });
  });

  it("explains the versions when there are none yet", async () => {
    request.mockResolvedValue([]);
    renderVersions();

    expect(await screen.findByText(/Aún no hay versiones/)).toBeInTheDocument();
  });
});

const doc = (...lines: string[]): TipTapDocument => ({
  type: "doc",
  content: lines.map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] })),
});

describe("looking at a version", () => {
  afterEach(() => {
    cleanup();
  });

  function renderView(content: TipTapDocument, current: TipTapDocument) {
    const handlers = { onRestore: vi.fn(), onBack: vi.fn() };
    render(<VersionView version={list[1]} content={content} current={current} {...handlers} />);
    return { ...handlers, user: userEvent.setup() };
  }

  it("shows the current text with what changed since, as pencil corrections", () => {
    renderView(doc("rocín flaco y galgo corredor"), doc("rocín muy flaco y galgo"));

    const page = screen.getByRole("region", { name: "Versión: Antes de la batalla" });
    expect(
      within(page)
        .getAllByRole("insertion")
        .map((mark) => mark.textContent),
    ).toContain("muy ");
    expect(
      within(page)
        .getAllByRole("deletion")
        .map((mark) => mark.textContent),
    ).toContain(" corredor");
  });

  it("says so when nothing changed", () => {
    renderView(doc("igual"), doc("igual"));
    expect(screen.getByText("Esta versión dice lo mismo que el texto actual.")).toBeInTheDocument();
  });

  it("restores only after confirming, and goes back with Escape", async () => {
    const { onRestore, onBack, user } = renderView(doc("antes"), doc("ahora"));

    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    const confirm = screen.getByRole("alertdialog", { name: "Restaurar versión" });
    expect(within(confirm).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onRestore).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restaurar" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Restaurar" }),
    );
    expect(onRestore).toHaveBeenCalled();

    screen.getByRole("button", { name: "Volver al texto" }).focus();
    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalled();
  });

  it("can be read as it was written", async () => {
    const { user } = renderView(doc("Texto de entonces"), doc("Texto de ahora"));

    await user.click(screen.getByRole("button", { name: "Leer la versión" }));

    expect(await screen.findByText("Texto de entonces")).toBeInTheDocument();
    expect(screen.queryByText("Texto de ahora")).not.toBeInTheDocument();
  });
});

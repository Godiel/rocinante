// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentEntry, ProjectIndex } from "../../bridge/generated/protocol";

const request = vi.fn();
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
}));

import { Outline, type OutlineProps } from "./Outline";
import { UndoNotice, UNDO_MS } from "./UndoNotice";
import { isOutlineShortcut } from "./shortcut";

function entry(id: string, kind: DocumentEntry["kind"], title: string, position: number) {
  return {
    id,
    kind,
    title,
    position,
    createdAt: "2026-03-14T09:00:00+00:00",
    deletedAt: null,
  } satisfies DocumentEntry;
}

const index: ProjectIndex = {
  chapters: [
    entry("c1", "chapter", "Que trata de la condición del hidalgo", 0),
    entry("c2", "chapter", "La primera salida", 1),
  ],
  fragments: [entry("f1", "fragment", "Los molinos", 0)],
  trash: [
    { ...entry("t1", "chapter", "Prólogo descartado", 0), deletedAt: "2026-03-15T10:00:00+00:00" },
  ],
};

function renderOutline(overrides: Partial<OutlineProps> = {}) {
  const props: OutlineProps = {
    index,
    currentId: "c2",
    mode: "docked",
    origin: "main",
    onOpen: vi.fn(),
    onModeChange: vi.fn(),
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    onProblem: vi.fn(),
    ...overrides,
  };
  render(<Outline {...props} />);
  return { ...props, user: userEvent.setup() };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: `Acciones de «${title}»` }));
  return screen.getByRole("menu", { name: `Acciones de «${title}»` });
}

describe("the index", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(index);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the chapters numbered in order, the drawer and the open document", () => {
    renderOutline();

    const chapters = screen.getByRole("region", { name: "Capítulos" });
    expect(
      within(chapters)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("IQue trata de la condición del hidalgo"),
      expect.stringContaining("IILa primera salida"),
    ]);
    expect(
      within(screen.getByRole("region", { name: "Cajón de fragmentos" })).getByText("Los molinos"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "La primera salida" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens a document when its title is chosen", async () => {
    const { onOpen, user } = renderOutline();

    await user.click(screen.getByRole("button", { name: "Los molinos" }));

    expect(onOpen).toHaveBeenCalledWith("f1");
  });

  it("creates a chapter, opens it and asks for its title", async () => {
    request.mockResolvedValueOnce(entry("c3", "chapter", "Capítulo sin título", 2));
    const { onOpen, user } = renderOutline();

    await user.click(screen.getByRole("button", { name: "Capítulo nuevo" }));

    expect(request).toHaveBeenCalledWith("document.create", {
      kind: "chapter",
      title: "Capítulo sin título",
      origin: "main",
    });
    expect(onOpen).toHaveBeenCalledWith("c3");
  });

  it("renames with a double click, keeping it on Enter and leaving it on Escape", async () => {
    const { user } = renderOutline();

    await user.dblClick(screen.getByRole("button", { name: "Los molinos" }));
    const field = screen.getByRole("textbox", { name: "Título" });
    await user.clear(field);
    await user.type(field, "  Los gigantes {Enter}");

    expect(request).toHaveBeenCalledWith("document.rename", {
      id: "f1",
      title: "Los gigantes",
      origin: "main",
    });

    request.mockClear();
    await user.dblClick(screen.getByRole("button", { name: "La primera salida" }));
    await user.type(screen.getByRole("textbox", { name: "Título" }), "x{Escape}");
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "La primera salida" })).toBeInTheDocument();
  });

  it("converts a chapter into a fragment at the end of the drawer, and back", async () => {
    const { user } = renderOutline();

    await user.click(within(await openMenu(user, "La primera salida")).getByText("Pasar al cajón"));
    expect(request).toHaveBeenCalledWith("document.move", {
      id: "c2",
      kind: "fragment",
      position: 1,
      origin: "main",
    });

    await user.click(
      within(await openMenu(user, "Los molinos")).getByText("Convertir en capítulo"),
    );
    expect(request).toHaveBeenCalledWith("document.move", {
      id: "f1",
      kind: "chapter",
      position: 2,
      origin: "main",
    });
  });

  it("asks before sending a document to the trash", async () => {
    const { onDeleted, user } = renderOutline();

    await user.click(within(await openMenu(user, "Los molinos")).getByText("Eliminar…"));
    const confirm = screen.getByRole("alertdialog", {
      name: "¿Enviar «Los molinos» a la papelera?",
    });
    expect(within(confirm).getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(request).not.toHaveBeenCalled();

    await user.click(within(await openMenu(user, "Los molinos")).getByText("Eliminar…"));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(request).toHaveBeenCalledWith("document.delete", { id: "f1", origin: "main" });
    expect(onDeleted).toHaveBeenCalledWith(index.fragments[0]);
  });

  it("restores from the trash", async () => {
    const { user } = renderOutline();

    await user.click(screen.getByText("Papelera (1)"));
    await user.click(screen.getByRole("button", { name: "Restaurar «Prólogo descartado»" }));

    expect(request).toHaveBeenCalledWith("document.restore", { id: "t1", origin: "main" });
  });

  it("tells the writer when the core refuses", async () => {
    request.mockRejectedValueOnce(new Error("disco lleno"));
    const { onProblem, user } = renderOutline();

    await user.click(screen.getByRole("button", { name: "Fragmento nuevo" }));

    expect(onProblem).toHaveBeenCalledWith(expect.any(String));
  });

  it("switches between docked and floating, and closes with Escape", async () => {
    const { onModeChange, onClose, user } = renderOutline();

    await user.click(screen.getByRole("button", { name: "Flotar" }));
    expect(onModeChange).toHaveBeenCalledWith("floating");

    screen.getByRole("button", { name: "Los molinos" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("describes dragging in Spanish for screen readers", () => {
    renderOutline();
    expect(screen.getByRole("button", { name: "Mover «Los molinos»" })).toHaveAttribute(
      "aria-roledescription",
    );
    expect(document.body).toHaveTextContent("Para mover este documento pulsa Espacio");
  });
});

describe("undoing a deletion", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("offers the way back for a while and then leaves", () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UndoNotice
        message="«Los molinos» está en la papelera."
        onUndo={onUndo}
        onDismiss={onDismiss}
      />,
    );

    act(() => screen.getByRole("button", { name: "Deshacer" }).click());
    expect(onUndo).toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("the index shortcut", () => {
  const press = (init: KeyboardEventInit) => isOutlineShortcut(new KeyboardEvent("keydown", init));

  it("is Ctrl+Mayús+I on any layout, never with AltGr", () => {
    expect(press({ ctrlKey: true, shiftKey: true, code: "KeyI" })).toBe(true);
    expect(press({ metaKey: true, shiftKey: true, code: "KeyI" })).toBe(true);
    expect(press({ ctrlKey: true, code: "KeyI" })).toBe(false);
    expect(press({ ctrlKey: true, altKey: true, shiftKey: true, code: "KeyI" })).toBe(false);
  });
});

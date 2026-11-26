// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementSummary, Note } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { contentFromText } from "./content";
import { NotesPanel, type NotesPanelProps } from "./NotesPanel";
import { NOTE_SAVE_DELAY_MS, useNoteSaver } from "./useNoteSaver";

const FIRST = "0196a3b2-7c4d-7e8f-9a0b-000000000001";
const SECOND = "0196a3b2-7c4d-7e8f-9a0b-000000000002";

function note(id: string, text: string, more: Partial<Note> = {}): Note {
  return {
    id,
    documentId: FIRST,
    content: contentFromText(text),
    text,
    anchored: true,
    order: 0,
    resolvedAt: null,
    elements: [],
    createdAt: `2026-11-26T10:0${id}:00.000Z`,
    updatedAt: `2026-11-26T10:0${id}:00.000Z`,
    ...more,
  };
}

function element(id: string, name: string): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases: [],
    position: { x: 0, y: 0 },
    image: null,
  };
}

const antonio = element("e-antonio", "Antonio");
const claudio = element("e-claudio", "Claudio");

const notes = [
  note("1", "Revisar esta fecha", { order: 1 }),
  note("2", "Aquí Antonio aún no conoce a Claudio", {
    order: 0,
    elements: [antonio.id, claudio.id],
  }),
  note("3", "Un final en el Toboso", { documentId: null, anchored: false, order: null }),
  note("4", "Cambiar el nombre del ventero", {
    documentId: SECOND,
    resolvedAt: "2026-11-26T11:00:00.000Z",
  }),
  note("5", "Otra batalla", { documentId: SECOND, anchored: false, order: null }),
];

const handlers = {
  onOpen: vi.fn(),
  onGoToPassage: vi.fn(),
  onDelete: vi.fn(),
  onOpenElement: vi.fn(),
  onClose: vi.fn(),
  onProblem: vi.fn(),
};

function show(props: Partial<NotesPanelProps> = {}) {
  const all: NotesPanelProps = {
    notes,
    loaded: true,
    documents: [
      { id: FIRST, title: "Los molinos" },
      { id: SECOND, title: "La venta" },
    ],
    currentDocumentId: SECOND,
    elements: [antonio, claudio],
    origin: "main",
    opened: null,
    ...handlers,
    ...props,
  };
  const view = render(<NotesPanel {...all} />);
  return {
    ...view,
    user: userEvent.setup(),
    update: (more: Partial<NotesPanelProps>) => view.rerender(<NotesPanel {...all} {...more} />),
  };
}

const listed = () =>
  within(screen.getByRole("list", { name: "Notas" }))
    .queryAllByRole("button")
    .map((item) => item.querySelector(".notes-item-text")!.textContent);

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(null);
  for (const handler of Object.values(handlers)) handler.mockReset();
});

afterEach(cleanup);

describe("the list of notes", () => {
  it("shows the newest first, with where each belongs, and leaves the resolved ones out", () => {
    show();

    expect(listed()).toEqual([
      "Otra batalla",
      "Un final en el Toboso",
      "Aquí Antonio aún no conoce a Claudio",
      "Revisar esta fecha",
    ]);
    const item = screen.getByRole("button", { name: /^Aquí Antonio/ });
    expect(item).toHaveTextContent("Los molinos");
    expect(item).toHaveTextContent("Antonio, Claudio");
    expect(screen.getByRole("button", { name: /^Un final/ })).toHaveTextContent("Idea suelta");
    expect(screen.getByRole("button", { name: /^Otra batalla/ })).toHaveTextContent(
      "La venta, sin su pasaje",
    );
  });

  it("shows the resolved ones when asked", async () => {
    const { user } = show();

    await user.click(screen.getByRole("checkbox", { name: "Ver resueltas" }));

    expect(screen.getByRole("button", { name: /^Cambiar el nombre/ })).toHaveTextContent(
      "resuelta",
    );
  });

  it("filters by class, chapter and ficha, and the filters add up", async () => {
    const { user } = show();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Clase de nota" }),
      "Ideas sueltas",
    );
    expect(listed()).toEqual(["Un final en el Toboso"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Clase de nota" }), "Con fichas");
    expect(listed()).toEqual(["Aquí Antonio aún no conoce a Claudio"]);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Clase de nota" }),
      "Todas las notas",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Ficha" }), "Claudio");
    expect(listed()).toEqual(["Aquí Antonio aún no conoce a Claudio"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Capítulo" }), "La venta");
    expect(screen.getByRole("status")).toHaveTextContent("Ninguna nota coincide.");
  });

  it("shows a chapter in the order of its text", async () => {
    const { user } = show();

    await user.selectOptions(screen.getByRole("combobox", { name: "Capítulo" }), "Los molinos");

    expect(listed()).toEqual(["Aquí Antonio aún no conoce a Claudio", "Revisar esta fecha"]);
  });

  it("knows which chapter is open", async () => {
    const { user } = show();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Capítulo" }),
      "El capítulo abierto",
    );

    expect(listed()).toEqual(["Otra batalla"]);
  });

  it("finds words in the notes without minding case or accents", async () => {
    const { user } = show();

    await user.type(screen.getByRole("searchbox", { name: "Buscar en las notas" }), "AUN claudio");
    expect(listed()).toEqual(["Aquí Antonio aún no conoce a Claudio"]);

    await user.keyboard("{Escape}");
    expect(listed()).toHaveLength(4);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("leaves out the fichas in the trash", () => {
    show({ elements: [claudio] });

    expect(screen.getByRole("button", { name: /^Aquí Antonio/ })).toHaveTextContent("Claudio");
    expect(screen.getByRole("button", { name: /^Aquí Antonio/ })).not.toHaveTextContent(
      "Antonio, Claudio",
    );
    expect(screen.queryByRole("option", { name: "Antonio" })).not.toBeInTheDocument();
  });

  it("says how to start when there are no notes", () => {
    show({ notes: [] });

    expect(screen.getByText(/Aún no hay notas/)).toBeInTheDocument();
  });

  it("starts a new idea", async () => {
    const { user } = show();

    await user.click(screen.getByRole("button", { name: "Nueva idea" }));

    expect(handlers.onOpen).toHaveBeenCalledWith({ draft: true, elements: [] });
  });

  it("closes with Escape", async () => {
    const { user } = show();

    await user.click(screen.getByRole("checkbox", { name: "Ver resueltas" }));
    await user.keyboard("{Escape}");

    expect(handlers.onClose).toHaveBeenCalled();
  });
});

describe("a note open in the panel", () => {
  it("opens in place of the list, and the arrow or Escape go back", async () => {
    const view = show();
    const { user } = view;

    await user.click(screen.getByRole("button", { name: /^Revisar esta fecha/ }));
    expect(handlers.onOpen).toHaveBeenCalledWith({ id: "1" });

    view.update({ opened: { id: "1" } });
    expect(screen.getByRole("textbox", { name: "Texto de la nota" })).toHaveTextContent(
      "Revisar esta fecha",
    );
    expect(screen.getByText("Los molinos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Notas" }));
    expect(handlers.onOpen).toHaveBeenLastCalledWith(null);

    handlers.onOpen.mockClear();
    await user.click(screen.getByRole("checkbox", { name: "Resuelta" }));
    await user.keyboard("{Escape}");
    expect(handlers.onOpen).toHaveBeenLastCalledWith(null);
  });

  it("resolves and reopens it at once", async () => {
    const { user } = show({ opened: { id: "1" } });

    await user.click(screen.getByRole("checkbox", { name: "Resuelta" }));

    expect(request).toHaveBeenCalledWith("note.update", {
      id: "1",
      changes: { resolved: true },
      origin: "main",
    });
  });

  it("goes to the passage only of a note in the text, and deletes", async () => {
    const view = show({ opened: { id: "1" } });
    const { user } = view;

    await user.click(screen.getByRole("button", { name: "Ir al pasaje" }));
    expect(handlers.onGoToPassage).toHaveBeenCalledWith(notes[0]);
    await user.click(screen.getByRole("button", { name: "Borrar" }));
    expect(handlers.onDelete).toHaveBeenCalledWith(notes[0]);

    view.update({ opened: { id: "3" } });
    expect(screen.queryByRole("button", { name: "Ir al pasaje" })).not.toBeInTheDocument();
    expect(screen.getByText("Idea suelta")).toBeInTheDocument();
  });

  it("goes back to the list when the open note is no longer there", () => {
    show({ opened: { id: "nadie" } });

    expect(screen.getByRole("searchbox", { name: "Buscar en las notas" })).toBeInTheDocument();
  });

  it("shows a new idea with nothing to resolve or delete yet", () => {
    show({ opened: { draft: true, elements: [] } });

    expect(screen.getByRole("textbox", { name: "Texto de la nota" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Resuelta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar" })).not.toBeInTheDocument();
  });
});

describe("saving a note", () => {
  const events = { onProblem: vi.fn(), onCreated: vi.fn(), onIdle: vi.fn() };
  const typed = (text: string) => [{ content: contentFromText(text) }, text] as const;

  beforeEach(() => {
    vi.useFakeTimers();
    for (const event of Object.values(events)) event.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it("creates a new idea once it has words, linked with its fichas, and changes it after", async () => {
    const created = note("9", "Un final", { documentId: null });
    request.mockResolvedValueOnce(created);
    const { result } = renderHook(() => useNoteSaver(null, [antonio.id], "main", events));

    act(() => result.current.change(...typed("   ")));
    await act(() => vi.advanceTimersByTimeAsync(NOTE_SAVE_DELAY_MS));
    expect(request).not.toHaveBeenCalled();

    act(() => result.current.change(...typed("Un final")));
    await act(() => vi.advanceTimersByTimeAsync(NOTE_SAVE_DELAY_MS));
    expect(request).toHaveBeenCalledWith("note.create", {
      documentId: null,
      content: contentFromText("Un final"),
      anchored: false,
      elements: [antonio.id],
      origin: "main",
    });
    expect(events.onCreated).toHaveBeenCalledWith(created);

    act(() => result.current.change(...typed("Un final en el Toboso")));
    await act(() => vi.advanceTimersByTimeAsync(NOTE_SAVE_DELAY_MS));
    expect(request).toHaveBeenLastCalledWith("note.update", {
      id: "9",
      changes: { content: contentFromText("Un final en el Toboso") },
      origin: "main",
    });
    expect(events.onIdle).toHaveBeenCalled();
  });

  it("waits for a note that grew too long, and says so", async () => {
    const { result } = renderHook(() => useNoteSaver("1", [], "main", events));

    act(() => result.current.change(...typed("a".repeat(10_001))));
    await act(() => vi.advanceTimersByTimeAsync(NOTE_SAVE_DELAY_MS));

    expect(request).not.toHaveBeenCalled();
    expect(events.onProblem).toHaveBeenCalledWith("La nota es demasiado larga.");
  });

  it("saves what is pending when the note goes away", async () => {
    const { result, unmount } = renderHook(() => useNoteSaver("1", [], "main", events));

    act(() => result.current.change(...typed("Revisar")));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(request).toHaveBeenCalledWith("note.update", {
      id: "1",
      changes: { content: contentFromText("Revisar") },
      origin: "main",
    });
  });
});

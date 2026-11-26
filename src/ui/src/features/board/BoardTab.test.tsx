// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Element, ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import BoardTab, { MOVE_DELAY_MS, type BoardTabProps } from "./BoardTab";

// jsdom lays nothing out: React Flow needs a size to measure the pane and the cards.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ target } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.DOMMatrixReadOnly = class {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
      this.m22 = scale ? Number(scale) : 1;
    }
  } as unknown as typeof DOMMatrixReadOnly;
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get: () => 800 },
    offsetHeight: { configurable: true, get: () => 600 },
  });
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect;
});

function summary(id: string, name: string, x: number, y: number): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases: [],
    position: { x, y },
    image: null,
  };
}

const quixote = summary("q", "Alonso Quijano", 0, 0);
const sancho = summary("s", "Sancho Panza", 260, 0);

function boardOf(elements: ElementSummary[]): Board {
  return { elements, relationships: [], ownKinds: [], trash: [] };
}

function detail(of: ElementSummary): Element {
  return { ...of, attributes: [], description: { type: "doc", content: [{ type: "paragraph" }] } };
}

function show(props: Partial<BoardTabProps> = {}) {
  const all: BoardTabProps = {
    board: boardOf([quixote, sancho]),
    loaded: true,
    origin: "main",
    chooseImage: () => Promise.resolve(null),
    ...props,
  };
  const view = render(<BoardTab {...all} />);
  return {
    ...view,
    update: (more: Partial<BoardTabProps>) => view.rerender(<BoardTab {...all} {...more} />),
  };
}

const card = (name: string) => screen.getByText(name).closest<HTMLElement>(".react-flow__node")!;

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((method: string, params: { id?: string; position?: unknown }) => {
    if (method === "element.get")
      return Promise.resolve(
        detail([quixote, sancho].find((element) => element.id === params.id)!),
      );
    if (method === "element.create")
      return Promise.resolve(
        detail({ ...summary("n", "Ficha nueva", 0, 0), position: params.position as never }),
      );
    if (method === "board.mentions") return Promise.resolve({ elements: [] });
    if (method === "element.references")
      return Promise.resolve({ paragraphs: [], together: [], total: 0, chapters: 0 });
    return Promise.resolve({});
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the board", () => {
  it("shows each ficha as a card, with its name and what it is", () => {
    show();

    expect(card("Alonso Quijano")).toHaveAttribute("aria-label", "Alonso Quijano, Personaje");
    expect(card("Sancho Panza")).toBeInTheDocument();
    expect(screen.getAllByText("Personaje")).toHaveLength(2);
  });

  it("says how to start when there are no fichas", () => {
    show({ board: boardOf([]) });

    expect(screen.getByText(/Aún no hay fichas/)).toBeInTheDocument();
  });

  it("opens a card's ficha on the right, with a double click or with Intro", async () => {
    show();

    fireEvent.doubleClick(card("Sancho Panza"));
    const sheet = await screen.findByRole("complementary", { name: "Ficha" });
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Sancho Panza");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Nombre" }), { key: "Escape" });
    expect(sheet).not.toBeInTheDocument();
    expect(card("Sancho Panza")).toHaveFocus();

    fireEvent.keyDown(card("Alonso Quijano"), { key: "Enter" });
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Alonso Quijano");
  });

  it("closes the ficha when it goes to the trash", async () => {
    const view = show();
    fireEvent.doubleClick(card("Sancho Panza"));
    await screen.findByRole("textbox", { name: "Nombre" });

    view.update({ board: boardOf([quixote]) });

    expect(screen.queryByRole("complementary", { name: "Ficha" })).not.toBeInTheDocument();
  });

  it("makes a new ficha in a free place near the middle of the view, and opens it at its name", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: "Nueva ficha" }));

    const [, params] = request.mock.calls.find(([method]) => method === "element.create")!;
    expect(params).toMatchObject({ kind: "character", name: "Ficha nueva", origin: "main" });
    const { x, y } = params.position as { x: number; y: number };
    const coversAnother = [quixote, sancho].some(
      ({ position }) => Math.abs(position.x - x) < 260 && Math.abs(position.y - y) < 120,
    );
    expect(coversAnother).toBe(false);
  });

  it("keeps where a card was moved, once it stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show();
    const quixoteCard = card("Alonso Quijano");
    fireEvent.click(quixoteCard);
    quixoteCard.focus();

    fireEvent.keyDown(quixoteCard, { key: "ArrowRight" });
    fireEvent.keyDown(quixoteCard, { key: "ArrowRight" });
    expect(request).not.toHaveBeenCalledWith("board.move", expect.anything());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MOVE_DELAY_MS);
    });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("board.move", {
        positions: [{ id: "q", x: 10, y: 0 }],
        origin: "main",
      }),
    );
    expect(request.mock.calls.filter(([method]) => method === "board.move")).toHaveLength(1);
  });

  it("sends a card to the trash with Supr, and takes it back from the notice", async () => {
    const user = userEvent.setup();
    show();
    const quixoteCard = card("Alonso Quijano");
    fireEvent.click(quixoteCard);

    fireEvent.keyDown(quixoteCard, { key: "Backspace" });
    expect(request).not.toHaveBeenCalledWith("element.delete", expect.anything());

    fireEvent.keyDown(quixoteCard, { key: "Delete" });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("element.delete", { id: "q", origin: "main" }),
    );
    expect(await screen.findByText("«Alonso Quijano» está en la papelera.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("element.restore", { id: "q", origin: "main" }),
    );
  });

  it("sends the open ficha to the trash and closes it", async () => {
    const user = userEvent.setup();
    show();
    fireEvent.doubleClick(card("Sancho Panza"));

    await user.click(await screen.findByRole("button", { name: "Mandar a la papelera" }));

    expect(screen.queryByRole("complementary", { name: "Ficha" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("element.delete", { id: "s", origin: "main" }),
    );
  });
});

describe("the arrows on the board", () => {
  const related: Board = {
    ...boardOf([quixote, sancho]),
    relationships: [{ id: "r", from: "s", to: "q", kind: "builtin:servant-of", starts: null, ends: null }],
  };

  it("draws each relationship with its words, named for screen readers", () => {
    show({ board: related });

    expect(document.querySelector('[data-id="r"]')).toHaveAttribute(
      "aria-label",
      "Sancho Panza criado de Alonso Quijano",
    );
    expect(screen.getByText("criado de")).toBeInTheDocument();
  });

  it("opens an arrow from its words to change it", async () => {
    const user = userEvent.setup();
    show({ board: related });

    await user.click(screen.getByText("criado de"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Sancho Panza es… Alonso Quijano");
    await user.click(screen.getByRole("button", { name: "amigo de" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("relationship.update", {
        id: "r",
        kind: "builtin:friend-of",
        origin: "main",
      }),
    );
  });

  it("opens a focused arrow with Intro, and removes it from there", async () => {
    const user = userEvent.setup();
    show({ board: related });

    fireEvent.keyDown(document.querySelector('[data-id="r"]')!, { key: "Enter" });
    await user.click(screen.getByRole("button", { name: "Quitar la relación" }));

    expect(request).toHaveBeenCalledWith("relationship.delete", { id: "r", origin: "main" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("the helps of the board", () => {
  const toboso = { ...summary("t", "El Toboso", 0, 300), kind: "place" as const };
  const dulcinea = summary("d", "Dulcinea", 600, 300);
  const crowded: Board = {
    elements: [quixote, sancho, toboso, dulcinea],
    relationships: [
      { id: "r1", from: "s", to: "q", kind: "builtin:servant-of", starts: null, ends: null },
      { id: "r2", from: "d", to: "t", kind: "builtin:lives-in", starts: null, ends: null },
    ],
    ownKinds: [],
    trash: [],
  };

  it("hides a kind with its cards and arrows, and brings it back", async () => {
    const user = userEvent.setup();
    show({ board: crowded });
    const places = screen.getByRole("button", { name: "Lugares" });
    expect(places).toHaveAttribute("aria-pressed", "true");

    await user.click(places);

    expect(places).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("El Toboso")).not.toBeInTheDocument();
    expect(document.querySelector('[data-id="r2"]')).toBeNull();
    expect(screen.queryByText("vive en")).not.toBeInTheDocument();
    expect(card("Dulcinea")).toBeVisible();

    await user.click(places);
    expect(card("El Toboso")).toBeVisible();
  });

  it("lets the rest step back while one card is chosen", () => {
    show({ board: crowded });

    fireEvent.click(card("Sancho Panza"));

    expect(card("Sancho Panza")).not.toHaveClass("board-faded");
    expect(card("Alonso Quijano")).not.toHaveClass("board-faded");
    expect(card("Dulcinea")).toHaveClass("board-faded");
    expect(document.querySelector('[data-id="r1"]')).not.toHaveClass("board-faded");
    expect(document.querySelector('[data-id="r2"]')).toHaveClass("board-faded");
  });

  it("finds a card by name, even of a hidden kind, and leaves the keyboard on it", async () => {
    const user = userEvent.setup();
    show({ board: crowded });
    await user.click(screen.getByRole("button", { name: "Lugares" }));

    await user.type(screen.getByRole("searchbox", { name: "Buscar una tarjeta" }), "tobo{Enter}");

    expect(screen.getByRole("button", { name: "Lugares" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(card("El Toboso")).toHaveFocus());
    expect(card("El Toboso")).toHaveClass("selected");
    expect(screen.getByRole("searchbox", { name: "Buscar una tarjeta" })).toHaveValue("");
  });

  it("arranges every card in one move, and takes it back", async () => {
    const user = userEvent.setup();
    show({ board: crowded });

    await user.click(screen.getByRole("button", { name: "Ordenar" }));

    const moves = () => request.mock.calls.filter(([method]) => method === "board.move");
    await waitFor(() => expect(moves()).toHaveLength(1));
    const { positions } = moves()[0]![1] as { positions: { id: string }[] };
    expect(positions.map((position) => position.id).sort()).toEqual(["d", "q", "s", "t"]);

    await user.click(await screen.findByRole("button", { name: "Deshacer" }));

    await waitFor(() => expect(moves()).toHaveLength(2));
    expect(moves()[1]![1]).toEqual({
      positions: [
        { id: "q", x: 0, y: 0 },
        { id: "s", x: 260, y: 0 },
        { id: "t", x: 0, y: 300 },
        { id: "d", x: 600, y: 300 },
      ],
      origin: "main",
    });
  });

  it("has nothing to arrange with fewer than two cards", () => {
    show({ board: boardOf([quixote]) });

    expect(screen.getByRole("button", { name: "Ordenar" })).toBeDisabled();
  });
});

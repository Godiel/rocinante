// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Element, ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { ElementsPanel, type ElementsPanelProps } from "./ElementsPanel";
import { isElementsShortcut, nameFromSelection, panelWasOpen, rememberPanel } from "./panel";

function summary(id: string, name: string, more: Partial<ElementSummary> = {}): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases: [],
    position: { x: 0, y: 0 },
    image: null,
    ...more,
  };
}

const elements = [
  summary("s", "Sancho Panza", { aliases: ["el escudero"] }),
  summary("a", "Alonso Quijano", { aliases: ["Don Quijote"] }),
  summary("t", "El Toboso", { kind: "place" }),
  summary("y", "Yelmo de Mambrino", { kind: "other", otherKind: "Objeto" }),
  summary("j1", "Juan"),
  summary("j2", "Juan", { kind: "place" }),
];

function boardOf(list: ElementSummary[]): Board {
  return { elements: list, relationships: [], ownKinds: [], trash: [] };
}

function detail(of: ElementSummary): Element {
  return {
    ...of,
    attributes: [],
    description: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

const onOpen = vi.fn();
const onCreate = vi.fn();
const onClose = vi.fn();
const onTrash = vi.fn();
const onRestore = vi.fn();

function show(props: Partial<ElementsPanelProps> = {}) {
  const all: ElementsPanelProps = {
    board: boardOf(elements),
    loaded: true,
    openId: null,
    fresh: null,
    origin: "main",
    searchRequest: 0,
    chooseImage: () => Promise.resolve(null),
    onOpen,
    onCreate,
    onClose,
    onTrash,
    onRestore,
    onProblem: vi.fn(),
    ...props,
  };
  const view = render(<ElementsPanel {...all} />);
  return {
    ...view,
    update: (more: Partial<ElementsPanelProps>) =>
      view.rerender(<ElementsPanel {...all} {...more} />),
  };
}

/** The names in a group of the list, in the order they show. */
function namesIn(group: string): string[] {
  const section = screen.getByRole("button", { name: new RegExp(`^${group}`) }).closest("section");
  return within(section!)
    .queryAllByRole("listitem")
    .map((item) => item.querySelector(".elements-item-name")!.textContent ?? "");
}

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((method: string, params: { id: string }) =>
    method === "element.get"
      ? Promise.resolve(detail(elements.find((element) => element.id === params.id)!))
      : Promise.resolve({}),
  );
  onOpen.mockReset();
  onCreate.mockReset();
  onClose.mockReset();
  onTrash.mockReset();
  onRestore.mockReset();
});

afterEach(cleanup);

describe("the fichas beside the text", () => {
  it("groups them by kind, in Spanish alphabetical order", () => {
    show();

    const groups = screen.getAllByRole("heading", { level: 3 }).map((title) => title.textContent);
    expect(groups).toEqual(["Personajes (3)", "Lugares (2)", "Otros (1)"]);
    expect(namesIn("Personajes")).toEqual(["Alonso Quijano", "Juan", "Sancho Panza"]);
    expect(namesIn("Lugares")).toEqual(["El Toboso", "Juan"]);
    expect(screen.getByText("Objeto")).toBeInTheDocument();
  });

  it("folds and unfolds a group", async () => {
    const user = userEvent.setup();
    show();
    const characters = screen.getByRole("button", { name: "Personajes (3)" });

    await user.click(characters);
    expect(characters).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Sancho Panza")).not.toBeVisible();

    await user.click(characters);
    expect(screen.getByText("Sancho Panza")).toBeVisible();
  });

  it("finds by name and by alias, without minding accents or case", async () => {
    const user = userEvent.setup();
    show();
    const search = screen.getByRole("searchbox", { name: "Buscar una ficha" });

    await user.type(search, "QUIJOTE");
    expect(namesIn("Personajes")).toEqual(["Alonso Quijano"]);
    expect(screen.queryByRole("button", { name: /^Lugares/ })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "escudero");
    expect(namesIn("Personajes")).toEqual(["Sancho Panza"]);

    await user.clear(search);
    await user.type(search, "Dulcinea");
    expect(screen.getByRole("status")).toHaveTextContent("Ninguna ficha se llama así.");
  });

  it("shows a folded group while searching, so nothing found stays hidden", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Personajes (3)" }));

    await user.type(screen.getByRole("searchbox"), "Sancho");

    expect(screen.getByText("Sancho Panza")).toBeVisible();
  });

  it("marks the fichas that share a name", () => {
    show();

    expect(screen.getAllByText("(nombre repetido)")).toHaveLength(2);
  });

  it("opens a ficha in place of the list, and the arrow goes back", async () => {
    const user = userEvent.setup();
    const view = show();

    await user.click(screen.getByRole("button", { name: /Sancho Panza/ }));
    expect(onOpen).toHaveBeenCalledWith("s");

    view.update({ openId: "s" });
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue("Sancho Panza");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← Fichas" }));
    expect(onOpen).toHaveBeenLastCalledWith(null);
    view.update({ openId: null });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("goes back with Escape from the ficha, and closes with Escape from the list", async () => {
    const user = userEvent.setup();
    const view = show({ openId: "a" });
    await user.click(await screen.findByRole("textbox", { name: "Nombre" }));

    await user.keyboard("{Escape}");
    expect(onOpen).toHaveBeenLastCalledWith(null);

    view.update({ openId: null });
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("empties the search with Escape before closing", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByRole("searchbox"), "Juan");

    await user.keyboard("{Escape}");

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("goes back to the list when the open ficha goes to the trash", async () => {
    const view = show({ openId: "s" });
    expect(await screen.findByRole("textbox", { name: "Nombre" })).toBeInTheDocument();

    view.update({ openId: "s", board: boardOf(elements.filter((element) => element.id !== "s")) });

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("takes the keyboard to the search only when the writer opens it", () => {
    const view = show();
    expect(screen.getByRole("searchbox")).not.toHaveFocus();

    view.update({ searchRequest: 1 });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("starts a new ficha at its name, and one made from the text at its kind", async () => {
    const view = show({ openId: "a", fresh: { id: "a", field: "name" } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus());

    view.unmount();
    show({ openId: "t", fresh: { id: "t", field: "kind" } });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveFocus());
  });

  it("offers to make a ficha, and says how when there are none", async () => {
    const user = userEvent.setup();
    show({ board: boardOf([]) });

    expect(screen.getByText(/Aún no hay fichas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva ficha" }));
    expect(onCreate).toHaveBeenCalled();
  });
});

describe("fichas with the same name", () => {
  it("warns in both, each with the way to the other", async () => {
    const user = userEvent.setup();
    const view = show({ openId: "j1" });

    expect(await screen.findByText(/Otra ficha se llama igual/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Juan" }));
    expect(onOpen).toHaveBeenLastCalledWith("j2");

    view.update({ openId: "j2" });
    expect(await screen.findByText(/Otra ficha se llama igual/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Juan" }));
    expect(onOpen).toHaveBeenLastCalledWith("j1");
  });
});

describe("the trash of fichas", () => {
  const gone = summary("g", "Ginés de Pasamonte");

  it("sends the open ficha to the trash", async () => {
    const user = userEvent.setup();
    show({ openId: "s" });

    await user.click(await screen.findByRole("button", { name: "Mandar a la papelera" }));

    expect(onTrash).toHaveBeenCalledWith("s", "Sancho Panza");
  });

  it("keeps the trash at the foot of the list, and restores from there", async () => {
    const user = userEvent.setup();
    show({ board: { ...boardOf(elements), trash: [gone] } });

    const trash = screen.getByText("Papelera (1)");
    expect(trash.closest("details")).toBe(
      screen.getByText("Ginés de Pasamonte").closest("details"),
    );
    await user.click(trash);
    await user.click(screen.getByRole("button", { name: "Restaurar «Ginés de Pasamonte»" }));

    expect(onRestore).toHaveBeenCalledWith("g");
  });

  it("shows no trash while it is empty", () => {
    show();

    expect(screen.queryByText(/Papelera/)).not.toBeInTheDocument();
  });
});

describe("the panel's keys and memory", () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  it("opens with Ctrl+Mayús+E or ⌘+Mayús+E, whatever the layout", () => {
    expect(isElementsShortcut(key({ ctrlKey: true, shiftKey: true, code: "KeyE" }))).toBe(true);
    expect(isElementsShortcut(key({ metaKey: true, shiftKey: true, code: "KeyE" }))).toBe(true);
    expect(isElementsShortcut(key({ ctrlKey: true, code: "KeyE" }))).toBe(false);
    expect(
      isElementsShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true, code: "KeyE" })),
    ).toBe(false);
  });

  it("remembers in this window whether it was open", () => {
    rememberPanel(true);
    expect(panelWasOpen()).toBe(true);
    rememberPanel(false);
    expect(panelWasOpen()).toBe(false);
  });

  it("names a ficha after the selection, on one line", () => {
    expect(nameFromSelection("  Don\n  Quijote  ")).toBe("Don Quijote");
    expect(nameFromSelection("   ")).toBe("");
    expect(nameFromSelection("a".repeat(300))).toHaveLength(200);
  });
});

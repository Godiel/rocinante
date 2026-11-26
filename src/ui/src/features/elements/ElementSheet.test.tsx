// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element, ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));
const reduceImage = vi.hoisted(() => vi.fn());
vi.mock("./reduce-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./reduce-image")>()),
  reduceImage,
}));

import { savePendingNow } from "../../editor/pending-saves";
import { keepsItsOwnKeys } from "../../editor/own-keys";
import { ElementSheet, type ElementSheetProps } from "./ElementSheet";
import { SAVE_DELAY_MS } from "./useElementSaver";

const quixote: Element = {
  id: "q",
  kind: "character",
  otherKind: null,
  name: "Alonso Quijano",
  aliases: ["Don Quijote"],
  attributes: [
    { name: "Edad", value: "Cincuenta años" },
    { name: "Carácter", value: "" },
  ],
  description: { type: "doc", content: [{ type: "paragraph" }] },
  position: { x: 0, y: 0 },
  image: null,
};

function summary(id: string, name: string, aliases: string[] = []): ElementSummary {
  return {
    id,
    kind: "character",
    otherKind: null,
    name,
    aliases,
    position: { x: 0, y: 0 },
    image: null,
  };
}

const onProblem = vi.fn();
const onOpen = vi.fn();
const chooseImage = vi.fn(() => Promise.resolve<string | null>(null));

function show(element: Element = quixote, props: Partial<ElementSheetProps> = {}) {
  const all: ElementSheetProps = {
    element,
    others: [],
    origin: "main",
    chooseImage,
    onOpen,
    onProblem,
    ...props,
  };
  const view = render(<ElementSheet {...all} />);
  return {
    ...view,
    update: (next: Element, more: Partial<ElementSheetProps> = {}) =>
      view.rerender(<ElementSheet {...all} {...more} element={next} />),
  };
}

/** The changes sent in the last element.update, once the writer paused. */
async function lastChanges() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
  });
  const calls = request.mock.calls.filter(([method]) => method === "element.update");
  return calls.at(-1)?.[1].changes;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  request.mockReset();
  request.mockResolvedValue({});
  onProblem.mockReset();
  onOpen.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the ficha", () => {
  it("shows what the element has", () => {
    show();

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Alonso Quijano");
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue("character");
    expect(screen.getByRole("textbox", { name: "Alias 1" })).toHaveValue("Don Quijote");
    expect(screen.getByRole("textbox", { name: "Valor de «Edad»" })).toHaveValue("Cincuenta años");
    expect(
      screen.getByRole("textbox", { name: "Descripción de Alonso Quijano" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Poner una imagen" })).toBeInTheDocument();
  });

  it("saves a new name once the writer pauses, in a single request", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    const name = screen.getByRole("textbox", { name: "Nombre" });
    await user.clear(name);
    await user.type(name, "Don Quijote");

    expect(await lastChanges()).toMatchObject({ name: "Don Quijote" });
    expect(request.mock.calls.filter(([method]) => method === "element.update")).toHaveLength(1);
  });

  it("does not save a blank name and says why", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    await user.clear(screen.getByRole("textbox", { name: "Nombre" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un nombre.");
    expect(await lastChanges()).not.toHaveProperty("name");
  });

  it("asks what another kind is before changing to it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "other");
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe qué es");
    expect(await lastChanges()).not.toHaveProperty("kind");

    await user.type(screen.getByRole("textbox", { name: "Qué es" }), "Leyenda");
    expect(await lastChanges()).toMatchObject({ kind: "other", otherKind: "Leyenda" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "plot");
    expect(await lastChanges()).toMatchObject({ kind: "plot", otherKind: null });
  });

  it("adds, edits and takes away aliases", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    await user.type(
      screen.getByRole("textbox", { name: "Nuevo alias" }),
      "el Caballero de la Triste Figura{Enter}",
    );
    expect(await lastChanges()).toMatchObject({
      aliases: ["Don Quijote", "el Caballero de la Triste Figura"],
    });

    await user.click(screen.getByRole("button", { name: "Quitar el alias «Don Quijote»" }));
    expect(await lastChanges()).toMatchObject({ aliases: ["el Caballero de la Triste Figura"] });
  });

  it("adds, edits and takes away attributes, and needs a name for each", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    await user.type(screen.getByRole("textbox", { name: "Valor de «Carácter»" }), "Idealista");
    expect(await lastChanges()).toMatchObject({
      attributes: [
        { name: "Edad", value: "Cincuenta años" },
        { name: "Carácter", value: "Idealista" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Añadir un atributo" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Cada atributo necesita un nombre.");
    const names = screen.getAllByRole("textbox", { name: "Nombre del atributo" });
    await user.type(names[2]!, "Montura");
    expect(await lastChanges()).toMatchObject({
      attributes: [{ name: "Edad" }, { name: "Carácter" }, { name: "Montura", value: "" }],
    });

    await user.click(screen.getByRole("button", { name: "Quitar el atributo «Edad»" }));
    expect((await lastChanges()).attributes.map((each: { name: string }) => each.name)).toEqual([
      "Carácter",
      "Montura",
    ]);
  });

  it("moves an attribute with the keyboard", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    screen.getByRole("button", { name: "Mover el atributo «Carácter»" }).focus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowUp}");
    await user.keyboard(" ");

    await waitFor(async () =>
      expect((await lastChanges())?.attributes?.map((each: { name: string }) => each.name)).toEqual(
        ["Carácter", "Edad"],
      ),
    );
  });

  it("saves what is pending at once when the app asks for it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "!");
    await act(() => savePendingNow());

    expect(request).toHaveBeenCalledWith("element.update", {
      id: "q",
      changes: expect.objectContaining({ name: "Alonso Quijano!" }),
      origin: "main",
    });
  });

  it("shows what another window changed, unless the writer is typing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { update } = show();

    update({ ...quixote, name: "Don Quijote de la Mancha" });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Don Quijote de la Mancha");

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "!");
    update({ ...quixote, name: "Otro nombre" });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue(
      "Don Quijote de la Mancha!",
    );
  });

  it("keeps a trailing space the core trimmed while the writer goes on", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { update } = show();

    await user.type(screen.getByRole("textbox", { name: "Nombre" }), " ");
    await lastChanges();
    update({ ...quixote, name: "Alonso Quijano" });

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Alonso Quijano ");
  });

  it("tells the writer when another ficha goes by the same name, and opens it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show(quixote, {
      others: [
        summary("q", "Alonso Quijano"),
        summary("j", "Quijada", ["Don Quijote"]),
        summary("s", "Sancho"),
      ],
    });

    expect(screen.getByText(/Otra ficha se llama igual/)).toHaveTextContent(
      "Otra ficha se llama igual: Quijada.",
    );
    await user.click(screen.getByRole("button", { name: "Quijada" }));
    expect(onOpen).toHaveBeenCalledWith("j");
  });

  it("reduces a chosen image and keeps it in the work", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    chooseImage.mockResolvedValueOnce("C:/retratos/quijote.png");
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "element.readImage" ? { data: "iVBO", mediaType: "image/png" } : {},
      ),
    );
    reduceImage.mockResolvedValue({
      image: { data: "UklG", mediaType: "image/webp", bytes: 3 },
      thumbnail: { data: "/9j/", mediaType: "image/jpeg", bytes: 3 },
    });
    show();

    await user.click(screen.getByRole("button", { name: "Poner una imagen" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("element.setImage", {
        id: "q",
        image: "UklG",
        thumbnail: "/9j/",
        origin: "main",
      }),
    );
    expect(reduceImage).toHaveBeenCalledWith({ data: "iVBO", mediaType: "image/png" });
    expect(request).toHaveBeenCalledWith("element.readImage", { path: "C:/retratos/quijote.png" });
  });

  it("says so when a chosen image cannot be read", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    chooseImage.mockResolvedValueOnce("C:/roto.png");
    request.mockResolvedValue({ data: "iVBO", mediaType: "image/png" });
    reduceImage.mockRejectedValue(new Error("cannot decode"));
    show();

    await user.click(screen.getByRole("button", { name: "Poner una imagen" }));

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(expect.stringContaining("No se pudo leer esa imagen")),
    );
  });

  it("takes an image away", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    request.mockImplementation((method: string) =>
      Promise.resolve(method === "element.image" ? { data: "UklG", mediaType: "image/webp" } : {}),
    );
    show({ ...quixote, image: { version: 4 } });

    expect(await screen.findByRole("img", { name: "Imagen de Alonso Quijano" })).toHaveAttribute(
      "src",
      "data:image/webp;base64,UklG",
    );
    await user.click(screen.getByRole("button", { name: "Quitar la imagen" }));
    expect(request).toHaveBeenCalledWith("element.removeImage", { id: "q", origin: "main" });
  });

  it("keeps the shortcuts of the work away from its description", () => {
    show();

    const description = screen.getByRole("textbox", { name: "Descripción de Alonso Quijano" });
    expect(keepsItsOwnKeys(description)).toBe(true);
    expect(keepsItsOwnKeys(screen.getByRole("textbox", { name: "Nombre" }))).toBe(false);
    fireEvent.keyDown(description, { key: "F6" });
  });
});

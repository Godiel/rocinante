// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { ElementRelations } from "./ElementRelations";

function summary(
  id: string,
  name: string,
  kind: ElementSummary["kind"] = "character",
): ElementSummary {
  return { id, kind, otherKind: null, name, aliases: [], position: { x: 0, y: 0 }, image: null };
}

const board: Board = {
  elements: [
    summary("a", "Antonio"),
    summary("c", "Claudio"),
    summary("s", "Sevilla", "place"),
    summary("m", "Mateo"),
  ],
  relationships: [
    { id: "1", from: "c", to: "a", kind: "builtin:child-of" },
    { id: "2", from: "a", to: "s", kind: "builtin:lives-in" },
    { id: "3", from: "m", to: "a", kind: "own:1" },
  ],
  ownKinds: [{ id: "own:1", forward: "discípulo de", inverse: "maestro de" }],
  trash: [],
};

const onOpen = vi.fn();
const onProblem = vi.fn();

function show(elementId = "a", shown: Board = board) {
  render(
    <ElementRelations
      elementId={elementId}
      board={shown}
      origin="main"
      onOpen={onOpen}
      onProblem={onProblem}
    />,
  );
}

const rows = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => item.textContent!.replace(/[✎×]/g, "").replace(/\s+/g, " ").trim());

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({});
  onOpen.mockReset();
  onProblem.mockReset();
});

afterEach(cleanup);

describe("the relationships of a ficha", () => {
  it("reads each from this side, in order", () => {
    show("a");

    expect(rows()).toEqual(["maestro de Mateo", "padre de Claudio", "vive en Sevilla"]);
  });

  it("reads the same relationship from the other ficha", () => {
    show("c");

    expect(rows()).toEqual(["hijo de Antonio"]);
  });

  it("jumps to the other ficha", async () => {
    const user = userEvent.setup();
    show("a");

    await user.click(screen.getByRole("button", { name: "Claudio" }));

    expect(onOpen).toHaveBeenCalledWith("c");
  });

  it("takes a relationship away", async () => {
    const user = userEvent.setup();
    show("a");

    await user.click(screen.getByRole("button", { name: "Quitar «vive en Sevilla»" }));

    expect(request).toHaveBeenCalledWith("relationship.delete", { id: "2", origin: "main" });
  });

  it("relates it to another ficha found by name", async () => {
    const user = userEvent.setup();
    show("c");

    await user.click(screen.getByRole("button", { name: "Relacionar con…" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar la otra ficha" }), "sevi");
    await user.click(screen.getByRole("button", { name: /Sevilla/ }));
    await user.click(screen.getByRole("button", { name: "nació en" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("relationship.create", {
        from: "c",
        to: "s",
        kind: "builtin:born-in",
        origin: "main",
      }),
    );
  });

  it("changes a relationship from the side it reads", async () => {
    const user = userEvent.setup();
    show("a");

    await user.click(screen.getByRole("button", { name: "Cambiar «padre de Claudio»" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Claudio es… Antonio");
    await user.click(screen.getByRole("button", { name: "amigo de" }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("relationship.update", {
        id: "1",
        kind: "builtin:friend-of",
        origin: "main",
      }),
    );
  });

  it("says why it could not relate them", async () => {
    const user = userEvent.setup();
    request.mockRejectedValueOnce(new Error("gone"));
    show("c");

    await user.click(screen.getByRole("button", { name: "Relacionar con…" }));
    await user.keyboard("Mat{Enter}");
    await user.click(screen.getByRole("button", { name: "amigo de" }));

    await waitFor(() => expect(onProblem).toHaveBeenCalledWith(expect.stringMatching(/./)));
  });

  it("says so when it has none", () => {
    show("a", { ...board, relationships: [] });

    expect(screen.getByText("Aún no tiene relaciones.")).toBeInTheDocument();
  });
});

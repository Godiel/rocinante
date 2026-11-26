// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementSummary, Note } from "../../bridge/generated/protocol";
import { contentFromText } from "./content";
import { ElementNotes } from "./ElementNotes";
import { NoteElements } from "./NoteElements";

function element(id: string, name: string, aliases: string[] = []): ElementSummary {
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

const antonio = element("a", "Antonio");
const claudio = element("c", "Claudio", ["el hijo"]);
const toboso = { ...element("t", "El Toboso"), kind: "place" as const };

afterEach(cleanup);

describe("the fichas of a note", () => {
  it("opens each linked ficha and takes it off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOpenElement = vi.fn();
    render(
      <NoteElements
        linked={["a", "c"]}
        elements={[antonio, claudio, toboso]}
        onChange={onChange}
        onOpenElement={onOpenElement}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Claudio" }));
    expect(onOpenElement).toHaveBeenCalledWith("c");
    await user.click(screen.getByRole("button", { name: "Quitar «Antonio»" }));
    expect(onChange).toHaveBeenCalledWith(["c"]);
  });

  it("finds a ficha by its name or an alias, and Enter takes the first", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NoteElements
        linked={["a"]}
        elements={[antonio, claudio, toboso]}
        onChange={onChange}
        onOpenElement={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Enlazar con una ficha…" }));
    const search = screen.getByRole("searchbox", { name: "Buscar una ficha para enlazar" });
    expect(screen.queryByRole("button", { name: /^Antonio/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Personaje|Lugar/ })).toHaveLength(2);

    await user.type(search, "HIJO");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  it("keeps the link with a ficha in the trash, unseen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NoteElements
        linked={["gone", "c"]}
        elements={[claudio]}
        onChange={onChange}
        onOpenElement={vi.fn()}
      />,
    );

    expect(screen.queryByText("gone")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar «Claudio»" }));
    expect(onChange).toHaveBeenCalledWith(["gone"]);
  });
});

describe("the notes of a ficha", () => {
  const note = (id: string, text: string, resolved = false): Note => ({
    id,
    documentId: null,
    content: contentFromText(text),
    text,
    anchored: false,
    order: null,
    resolvedAt: resolved ? "2026-11-26T12:00:00.000Z" : null,
    elements: ["a"],
    createdAt: `2026-11-26T10:0${id}:00.000Z`,
    updatedAt: `2026-11-26T10:0${id}:00.000Z`,
  });

  it("lists them, newest first, opens each and starts a new one", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onNew = vi.fn();
    render(
      <ElementNotes
        notes={[note("1", "Antonio miente", true), note("2", "Antonio vuelve")]}
        onOpen={onOpen}
        onNew={onNew}
      />,
    );

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Antonio vuelve",
      "Antonio miente",
    ]);
    expect(screen.getByRole("button", { name: "Antonio miente" })).toHaveAttribute(
      "title",
      "Nota resuelta",
    );
    await user.click(screen.getByRole("button", { name: "Antonio vuelve" }));
    expect(onOpen).toHaveBeenCalledWith("2");
    await user.click(screen.getByRole("button", { name: "Nueva nota" }));
    expect(onNew).toHaveBeenCalled();
  });

  it("says when there are none", () => {
    render(<ElementNotes notes={[]} onOpen={vi.fn()} onNew={vi.fn()} />);

    expect(screen.getByText("Aún no tiene notas.")).toBeInTheDocument();
  });
});

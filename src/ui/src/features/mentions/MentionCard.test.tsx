// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element, ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { MentionCard } from "./MentionCard";

function summary(id: string, name: string): ElementSummary {
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

const juan = summary("j1", "Juan");
const juanito = { ...summary("j2", "Juanito"), kind: "other" as const, otherKind: "Mascota" };

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((_method: string, { id }: { id: string }) =>
    Promise.resolve({
      ...(id === "j1" ? juan : juanito),
      attributes: [
        { name: "Edad", value: "cuarenta" },
        { name: "Ojos", value: " " },
        { name: "Oficio", value: "ventero" },
        { name: "Pelo", value: "cano" },
        { name: "Voz", value: "ronca" },
      ],
      description: { type: "doc", content: [] },
    } satisfies Element),
  );
});

afterEach(cleanup);

describe("the ficha in small over a mention", () => {
  it("shows what the ficha is and its first attributes with a value, and opens it", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <MentionCard
        elements={[juan]}
        top={0}
        left={0}
        onOpen={onOpen}
        onEnter={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    const card = screen.getByRole("dialog", { name: "Ficha de Juan" });
    expect(card).toHaveTextContent("Personaje");
    expect(await screen.findByText("ventero")).toBeInTheDocument();
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "cuarenta",
      "ventero",
      "cano",
    ]);
    await user.click(screen.getByRole("button", { name: "Abrir la ficha" }));
    expect(onOpen).toHaveBeenCalledWith("j1");
  });

  it("shows every ficha that shares the name", () => {
    render(
      <MentionCard
        elements={[juan, juanito]}
        top={0}
        left={0}
        onOpen={vi.fn()}
        onEnter={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Fichas con este nombre" })).toHaveTextContent(
      "Mascota",
    );
    expect(screen.getAllByRole("button", { name: "Abrir la ficha" })).toHaveLength(2);
  });

  it("stays while the hand is on it", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    render(
      <MentionCard
        elements={[juan]}
        top={0}
        left={0}
        onOpen={vi.fn()}
        onEnter={onEnter}
        onLeave={onLeave}
      />,
    );

    await user.hover(screen.getByRole("dialog"));
    await user.unhover(screen.getByRole("dialog"));

    expect(onEnter).toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalled();
  });
});

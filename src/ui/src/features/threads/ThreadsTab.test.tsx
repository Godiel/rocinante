// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, ElementSummary, Threads } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { ThreadsTab } from "./ThreadsTab";

const origin = "main";

function summary(
  id: string,
  name: string,
  kind: ElementSummary["kind"] = "character",
): ElementSummary {
  return {
    id,
    kind,
    otherKind: null,
    name,
    aliases: [],
    position: { x: 0, y: 0 },
    imageVersion: null,
    attributes: [],
  } as unknown as ElementSummary;
}

const board: Board = {
  elements: [summary("a", "Antonio"), summary("c", "Claudio"), summary("m", "Madrid", "place")],
  relationships: [
    { id: "r1", from: "a", to: "c", kind: "builtin:friend-of", starts: "uno", ends: "uno" },
    { id: "r2", from: "a", to: "c", kind: "builtin:enemy-of", starts: "dos", ends: null },
  ],
  ownKinds: [],
  trash: [],
};

const threads: Threads = {
  chosen: ["a", "c"],
  chapters: [
    { documentId: "uno", title: "La venta" },
    { documentId: "dos", title: "El camino" },
  ],
  threads: [
    { elementId: "a", points: [{ documentId: "uno", mentions: 3 }] },
    {
      elementId: "c",
      points: [
        { documentId: "uno", mentions: 1 },
        { documentId: "dos", mentions: 2 },
      ],
    },
  ],
  meetings: [{ documentId: "uno", first: "a", second: "c", paragraphs: 1 }],
  milestones: [
    {
      id: "h",
      elementId: "a",
      documentId: "uno",
      passage: "Aquella noche murió el padre de Antonio.",
      text: "Muere su padre",
      lost: false,
      createdAt: "2026-11-26T10:00:00.000Z",
    },
  ],
};

function show(shown: Threads | null = threads) {
  const onGoToMention = vi.fn();
  const onGoToPassage = vi.fn();
  const onProblem = vi.fn();
  render(
    <ThreadsTab
      threads={shown}
      board={board}
      origin={origin}
      onGoToMention={onGoToMention}
      onGoToPassage={onGoToPassage}
      onProblem={onProblem}
    />,
  );
  return { onGoToMention, onGoToPassage, onProblem };
}

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(null);
});
afterEach(cleanup);

describe("the threads of fate", () => {
  it("draws the chapters, a line for each chosen ficha and its points, with what happens to it", () => {
    show();

    expect(screen.getByRole("button", { name: "Capítulo 1: La venta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capítulo 2: El camino" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Antonio en «La venta»: 3 menciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Claudio en «El camino»: 2 menciones" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Antonio en «El camino»/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hito de Antonio: Muere su padre" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Antonio y Claudio: 1 párrafo juntos")).toBeInTheDocument();
  });

  it("says what to do when there are no chapters or no fichas to follow", () => {
    show({ ...threads, chapters: [] });
    expect(screen.getByText(/aún no hay ninguno/)).toBeInTheDocument();
    cleanup();
    show({ ...threads, chosen: [] });
    expect(screen.getByText(/Elige qué fichas seguir/)).toBeInTheDocument();
  });

  it("chooses the fichas to follow", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: "Elegir fichas" }));
    await user.click(screen.getByRole("checkbox", { name: "Madrid" }));
    expect(request).toHaveBeenCalledWith("threads.choose", { elements: ["a", "c", "m"], origin });
    await user.click(screen.getByRole("checkbox", { name: "Antonio" }));
    expect(request).toHaveBeenLastCalledWith("threads.choose", { elements: ["c"], origin });
  });

  it("shows the relationships that hold in a chapter, and where they start or end", async () => {
    const user = userEvent.setup();
    show();

    await user.click(screen.getByRole("button", { name: "Capítulo 1: La venta" }));
    const held = screen.getByRole("list", { name: "Relaciones vigentes" });
    expect(held).toHaveTextContent("Antonio amigo de Claudio · empieza aquí · termina aquí");
    expect(held).not.toHaveTextContent("enemigo");

    await user.click(screen.getByRole("button", { name: "Capítulo 2: El camino" }));
    expect(screen.getByRole("list", { name: "Relaciones vigentes" })).toHaveTextContent(
      "Antonio enemigo de Claudio · empieza aquí",
    );
  });

  it("opens the mentions of a point, goes to one and marks there what happens", async () => {
    const user = userEvent.setup();
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "element.references"
          ? {
              total: 1,
              chapters: 1,
              first: { documentId: "dos", ordinal: 0 },
              documents: [
                {
                  documentId: "dos",
                  mentions: [
                    { ordinal: 0, before: "Y ", text: "Claudio", after: " se fue al camino." },
                  ],
                },
              ],
              together: [],
            }
          : null,
      ),
    );
    const { onGoToMention } = show();

    await user.click(screen.getByRole("button", { name: "Claudio en «El camino»: 2 menciones" }));
    const mention = await screen.findByRole("button", { name: "Y Claudio se fue al camino." });
    await user.click(mention);
    expect(onGoToMention).toHaveBeenCalledWith("c", "dos", 0);

    await user.click(screen.getByRole("button", { name: "Marcar hito" }));
    await user.type(screen.getByLabelText("¿Qué le ocurre?"), "Se marcha");
    await user.click(screen.getByRole("button", { name: "Marcar" }));
    expect(request).toHaveBeenCalledWith("milestone.create", {
      elementId: "c",
      documentId: "dos",
      passage: "Y Claudio se fue al camino.",
      text: "Se marcha",
      origin,
    });
  });

  it("corrects a milestone, goes to its passage and removes it", async () => {
    const user = userEvent.setup();
    const { onGoToPassage } = show();

    await user.click(screen.getByRole("button", { name: "Hito de Antonio: Muere su padre" }));
    const detail = screen.getByRole("complementary");
    const text = within(detail).getByLabelText("¿Qué le ocurre?");
    await user.clear(text);
    await user.type(text, "Queda huérfano");
    await user.click(within(detail).getByRole("button", { name: "Guardar" }));
    expect(request).toHaveBeenCalledWith("milestone.update", {
      id: "h",
      text: "Queda huérfano",
      origin,
    });

    await user.click(within(detail).getByRole("button", { name: "Ir al pasaje" }));
    expect(onGoToPassage).toHaveBeenCalledWith("uno", "Aquella noche murió el padre de Antonio.");

    await user.click(within(detail).getByRole("button", { name: "Borrar hito" }));
    expect(request).toHaveBeenCalledWith("milestone.delete", { id: "h", origin });
    await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
  });

  it("says when a milestone lost its passage", async () => {
    const user = userEvent.setup();
    show({ ...threads, milestones: [{ ...threads.milestones[0]!, lost: true }] });

    await user.click(
      screen.getByRole("button", { name: "Hito de Antonio: Muere su padre (sin pasaje)" }),
    );
    expect(screen.getByText(/Sin pasaje/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir al pasaje" })).not.toBeInTheDocument();
  });
});

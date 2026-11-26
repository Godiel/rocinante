// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "../../bridge/generated/protocol";
import { CoreError } from "../../bridge/core";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { ProposalList } from "./ProposalList";

const origin = "main";
const passage = "Antonio llegó con su hijo Claudio, pelirrojo como él.";

function base(id: string): Proposal {
  return {
    id,
    kind: "element",
    documentId: "doc",
    passage,
    createdAt: "2026-11-26T10:00:00.000Z",
    element: null,
    relationship: null,
    attribute: null,
    milestone: null,
  };
}

const element: Proposal = {
  ...base("e"),
  element: { name: "Claudio", kind: "character", otherKind: null },
};
const relationship: Proposal = {
  ...base("r"),
  kind: "relationship",
  relationship: { from: "Claudio", to: "Antonio", forward: "hijo de", inverse: "padre de" },
};
const attribute: Proposal = {
  ...base("a"),
  kind: "attribute",
  attribute: { element: "Antonio", name: "Pelo", value: "pelirrojo" },
};

const milestone: Proposal = {
  ...base("h"),
  kind: "milestone",
  milestone: { element: "Antonio", text: "Llega con su hijo" },
};

function list(proposals: Proposal[] = [element, relationship, attribute]) {
  const onGoToPassage = vi.fn();
  const onProblem = vi.fn();
  render(
    <ProposalList
      proposals={proposals}
      enabled
      origin={origin}
      onGoToPassage={onGoToPassage}
      onProblem={onProblem}
    />,
  );
  return { onGoToPassage, onProblem };
}

const item = (text: RegExp) => screen.getByText(text).closest("li")!;

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(null);
});
afterEach(cleanup);

describe("the proposals of the squire", () => {
  it("says each one with its passage, and goes to it", async () => {
    const user = userEvent.setup();
    const { onGoToPassage } = list();

    expect(item(/Ficha nueva/)).toHaveTextContent("Ficha nueva: Claudio · Personaje");
    expect(item(/es hijo de/)).toHaveTextContent("Claudio es hijo de Antonio");
    expect(item(/Pelo/)).toHaveTextContent("Antonio · Pelo: pelirrojo");
    expect(screen.getAllByText(passage)).toHaveLength(3);

    await user.click(within(item(/Ficha nueva/)).getByRole("button", { name: "Ir al pasaje" }));
    expect(onGoToPassage).toHaveBeenCalledWith(element);
  });

  it("accepts and dismisses", async () => {
    const user = userEvent.setup();
    list();

    await user.click(within(item(/Ficha nueva/)).getByRole("button", { name: "Aceptar" }));
    expect(request).toHaveBeenCalledWith("proposal.accept", { id: "e", origin });
    await user.click(within(item(/Pelo/)).getByRole("button", { name: "Descartar" }));
    expect(request).toHaveBeenCalledWith("proposal.dismiss", { id: "a", origin });
  });

  it("accepts what the writer corrected, and only that", async () => {
    const user = userEvent.setup();
    list();

    await user.click(within(item(/Ficha nueva/)).getByRole("button", { name: "Corregir" }));
    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Claudio el Joven");
    await user.selectOptions(screen.getByLabelText("Tipo"), "other");
    await user.type(screen.getByLabelText("¿Qué es?"), "Pariente");
    await user.click(screen.getByRole("button", { name: "Aceptar así" }));
    expect(request).toHaveBeenCalledWith("proposal.accept", {
      id: "e",
      changes: { name: "Claudio el Joven", kind: "other", otherKind: "Pariente" },
      origin,
    });

    await user.click(within(item(/es hijo de/)).getByRole("button", { name: "Corregir" }));
    const forward = screen.getByLabelText("De Claudio a Antonio");
    await user.clear(forward);
    await user.type(forward, "sobrino de");
    await user.click(screen.getByRole("button", { name: "Aceptar así" }));
    expect(request).toHaveBeenLastCalledWith("proposal.accept", {
      id: "r",
      changes: { forward: "sobrino de" },
      origin,
    });
  });

  it("proposes a milestone, and accepts it as the writer said it", async () => {
    const user = userEvent.setup();
    list([milestone]);

    expect(item(/Hito de/)).toHaveTextContent("Hito de Antonio: Llega con su hijo");
    await user.click(screen.getByRole("button", { name: "Corregir" }));
    const text = screen.getByLabelText("¿Qué le ocurre?");
    await user.clear(text);
    await user.type(text, "Vuelve a la venta");
    await user.click(screen.getByRole("button", { name: "Aceptar así" }));
    expect(request).toHaveBeenCalledWith("proposal.accept", {
      id: "h",
      changes: { text: "Vuelve a la venta" },
      origin,
    });
  });

  it("says why a relationship has to wait for its ficha", async () => {
    const user = userEvent.setup();
    request.mockRejectedValue(new CoreError(1, "", "proposalElementMissing"));
    const { onProblem } = list([relationship]);

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(onProblem).toHaveBeenLastCalledWith(expect.stringMatching(/acepta primero la ficha/));
  });

  it("says what to do when there is nothing", () => {
    list([]);
    expect(screen.getByText(/Al terminar un párrafo/)).toBeInTheDocument();
  });
});

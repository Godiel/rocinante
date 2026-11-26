// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementSummary } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { MilestoneSlip } from "./MilestoneSlip";

const paragraph = "Aquella noche murió el padre de Toño, sin decir palabra.";

function summary(id: string, name: string, aliases: string[] = []): ElementSummary {
  return { id, kind: "character", otherKind: null, name, aliases } as unknown as ElementSummary;
}

const elements = [
  summary("b", "Beatriz"),
  summary("a", "Antonio", ["Toño"]),
  summary("c", "Claudio"),
];

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(null);
});
afterEach(cleanup);

describe("marking a milestone from the text", () => {
  it("offers first the fichas named in the paragraph, saves the page and marks it", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const beforeMarking = vi.fn(() => {
      order.push("saved");
      return Promise.resolve();
    });
    request.mockImplementation((method: string) => {
      order.push(method);
      return Promise.resolve(null);
    });
    const onDone = vi.fn();
    render(
      <MilestoneSlip
        paragraph={paragraph}
        documentId="uno"
        elements={elements}
        origin="main"
        beforeMarking={beforeMarking}
        onDone={onDone}
        onProblem={() => {}}
      />,
    );

    const element = screen.getByLabelText("Ficha");
    expect(element).toHaveValue("a");
    expect(screen.getByRole("group", { name: "En este párrafo" })).toHaveTextContent("Antonio");
    await user.type(screen.getByLabelText("¿Qué le ocurre?"), "Muere su padre");
    await user.click(screen.getByRole("button", { name: "Marcar" }));

    expect(request).toHaveBeenCalledWith("milestone.create", {
      elementId: "a",
      documentId: "uno",
      passage: paragraph,
      text: "Muere su padre",
      origin: "main",
    });
    expect(order).toEqual(["saved", "milestone.create"]);
    expect(onDone).toHaveBeenCalled();
  });

  it("asks for a ficha first when the work has none", () => {
    render(
      <MilestoneSlip
        paragraph={paragraph}
        documentId="uno"
        elements={[]}
        origin="main"
        onDone={() => {}}
        onProblem={() => {}}
      />,
    );
    expect(screen.getByText(/crea antes la ficha/)).toBeInTheDocument();
  });
});

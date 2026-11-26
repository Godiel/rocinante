// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: () => Promise.resolve(() => {}),
}));

import { Suggestions } from "./Suggestions";

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((method: string) =>
    Promise.resolve(
      method === "suggestions.get"
        ? [
            { name: "Dulcinea", count: 7 },
            { name: "Maritornes", count: 3 },
          ]
        : null,
    ),
  );
});

afterEach(cleanup);

describe("the suggested fichas", () => {
  it("lists the names with how many times they appear, and makes a ficha of one", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<Suggestions origin="main" onCreate={onCreate} onProblem={vi.fn()} />);

    await user.click(await screen.findByText("Sugerencias (2)"));
    expect(screen.getByText("(7 veces)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear la ficha de «Dulcinea»" }));

    expect(onCreate).toHaveBeenCalledWith("Dulcinea");
  });

  it("dismisses one for good", async () => {
    const user = userEvent.setup();
    render(<Suggestions origin="main" onCreate={vi.fn()} onProblem={vi.fn()} />);

    await user.click(await screen.findByText("Sugerencias (2)"));
    await user.click(screen.getByRole("button", { name: "Descartar «Maritornes»" }));

    expect(request).toHaveBeenCalledWith("suggestion.dismiss", {
      name: "Maritornes",
      origin: "main",
    });
    expect(screen.getByText("Sugerencias (1)")).toBeInTheDocument();
  });

  it("shows nothing while there is nothing to suggest", async () => {
    request.mockResolvedValue([]);
    const { container } = render(
      <Suggestions origin="main" onCreate={vi.fn()} onProblem={vi.fn()} />,
    );

    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});

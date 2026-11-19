// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const reportProblem = vi.hoisted(() => vi.fn());
const openLogFolder = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("./diagnostics", () => ({ reportProblem, openLogFolder }));

import { WindowGuard } from "./Trouble";

function Broken(): never {
  throw new Error("drawing failed");
}

describe("when a window breaks", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a way out instead of a blank page and tells the log", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <WindowGuard>
        <Broken />
      </WindowGuard>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Lo guardado está a salvo");
    expect(reportProblem).toHaveBeenCalledWith(
      expect.objectContaining({ message: "drawing failed" }),
    );
    expect(screen.getByRole("button", { name: "Volver a cargar la ventana" })).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Abrir la carpeta de registros" }));
    expect(openLogFolder).toHaveBeenCalled();
  });

  it("draws the window as usual while nothing breaks", () => {
    render(
      <WindowGuard>
        <p>Capítulo primero</p>
      </WindowGuard>,
    );
    expect(screen.getByText("Capítulo primero")).toBeInTheDocument();
  });
});

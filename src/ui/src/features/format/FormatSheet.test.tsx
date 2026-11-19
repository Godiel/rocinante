// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkFormat } from "../../bridge/generated/protocol";

const request = vi.fn();
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
}));

import { CoreError } from "../../bridge/core";
import { FormatSheet } from "./FormatSheet";

const novel: WorkFormat = {
  pageSize: "a5",
  pageWidth: 148,
  pageHeight: 210,
  margins: { top: 18, bottom: 22, inside: 20, outside: 15 },
  typeface: "ebGaramond",
  bodySize: 11,
  leading: 1.35,
  firstLineIndent: true,
  justified: true,
  dropCap: false,
};

function renderSheet() {
  const handlers = { onClose: vi.fn(), onProblem: vi.fn() };
  const view = render(
    <FormatSheet format={novel} title="Don Quijote" origin="main" {...handlers} />,
  );
  return { ...handlers, view };
}

describe("format sheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    request.mockReset();
    request.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("says whose format it is", () => {
    renderSheet();

    expect(screen.getByRole("complementary", { name: "Formato de «Don Quijote»" })).toBeVisible();
  });

  it("sends a change to the core once the writer pauses", () => {
    renderSheet();

    fireEvent.change(screen.getByLabelText("Cuerpo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Cuerpo"), { target: { value: "12" } });
    expect(request).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("project.setFormat", {
      format: { ...novel, bodySize: 12 },
      origin: "main",
    });
  });

  it("closing keeps the last change", () => {
    const { view } = renderSheet();

    fireEvent.click(screen.getByLabelText("Capitular al empezar cada capítulo"));
    view.unmount();

    expect(request).toHaveBeenCalledWith("project.setFormat", {
      format: { ...novel, dropCap: true },
      origin: "main",
    });
  });

  it("closes with Escape and with its button", () => {
    const { onClose } = renderSheet();

    fireEvent.keyDown(screen.getByLabelText("Tamaño"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("says in Spanish when the core refuses", async () => {
    request.mockRejectedValue(new CoreError(-32002, "Text area too small", "textAreaTooSmall"));
    const { onProblem } = renderSheet();

    fireEvent.click(screen.getByLabelText("Alineado a la izquierda"));
    await act(async () => vi.advanceTimersByTime(300));

    expect(onProblem).toHaveBeenLastCalledWith(
      "Los márgenes no dejan sitio al texto: debe quedar al menos una caja de 4 × 6 cm.",
    );
  });
});

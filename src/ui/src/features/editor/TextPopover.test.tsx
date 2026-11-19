// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextPopover } from "./TextPopover";

function renderSlip(initial = "", withDelete = false) {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn(), onDelete: vi.fn() };
  render(
    <TextPopover
      title="Nota"
      initial={initial}
      top={10}
      left={20}
      onSave={handlers.onSave}
      onCancel={handlers.onCancel}
      onDelete={withDelete ? handlers.onDelete : undefined}
    />,
  );
  return { ...handlers, user: userEvent.setup() };
}

describe("note slip", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens with the text to edit and saves it trimmed", async () => {
    const { onSave, user } = renderSlip("revisar");

    const text = screen.getByRole("textbox", { name: "Nota" });
    expect(text).toHaveFocus();
    await user.type(text, " esta fecha  ");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).toHaveBeenCalledWith("revisar esta fecha");
  });

  it("saves with Ctrl+Enter and leaves with Escape", async () => {
    const { onSave, onCancel, user } = renderSlip("aquí Antonio aún no conoce a Claudio");

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSave).toHaveBeenCalledWith("aquí Antonio aún no conoce a Claudio");

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not keep an empty note", async () => {
    const { onSave, user } = renderSlip("   ");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe algo o pulsa Escape para dejarlo.",
    );
  });

  it("offers to delete only what already exists", async () => {
    renderSlip("nueva");
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    cleanup();

    const { onDelete, user } = renderSlip("existente", true);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onDelete).toHaveBeenCalled();
  });
});

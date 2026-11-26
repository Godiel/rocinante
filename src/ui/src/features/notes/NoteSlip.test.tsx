// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TipTapDocument } from "../../bridge/generated/protocol";
import { keepsItsOwnKeys } from "../../editor/own-keys";
import { contentFromText } from "./content";
import { MAX_NOTE_LENGTH, NoteSlip, type NoteSlipProps } from "./NoteSlip";

function show(props: Partial<NoteSlipProps> = {}) {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn() };
  render(<NoteSlip initial={null} top={10} left={20} {...handlers} {...props} />);
  return { ...handlers, user: userEvent.setup() };
}

const existing = (text: string) => ({ content: contentFromText(text), text });

afterEach(cleanup);

describe("the slip of a note", () => {
  it("opens with the text ready to write, and keeps it with its formatting", async () => {
    const content: TipTapDocument = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "revisar " },
            { type: "text", marks: [{ type: "italic" }], text: "esta" },
          ],
        },
      ],
    };
    const { onSave, user } = show({ initial: { content, text: "revisar esta" } });
    const text = screen.getByRole("textbox", { name: "Texto de la nota" });
    await waitFor(() => expect(text).toHaveFocus());
    expect(text.querySelector("em")).toHaveTextContent("esta");

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).toHaveBeenCalledWith(content);
  });

  it("keeps the note with Ctrl+Enter, without a line break, and leaves with Escape", async () => {
    const { onSave, onCancel, user } = show({ initial: existing("aquí Antonio") });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Texto de la nota" })).toHaveFocus(),
    );

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSave).toHaveBeenCalledWith(contentFromText("aquí Antonio"));

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not keep an empty note", async () => {
    const { onSave, user } = show();

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe algo o pulsa Escape para dejarlo.",
    );
  });

  it("says so when a note is too long", async () => {
    const { onSave, user } = show({ initial: existing("a".repeat(MAX_NOTE_LENGTH + 1)) });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("La nota es demasiado larga.");
  });

  it("offers to delete and to open in the panel only a note that exists", async () => {
    const onDelete = vi.fn();
    const onOpenInPanel = vi.fn();
    const { user } = show({ initial: existing("revisar"), onDelete, onOpenInPanel });

    await user.click(screen.getByRole("button", { name: "Abrir en el panel" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onOpenInPanel).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();

    cleanup();
    show();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir en el panel" })).not.toBeInTheDocument();
  });

  it("keeps the shortcuts of the work away from the note", () => {
    show();

    expect(keepsItsOwnKeys(screen.getByRole("textbox", { name: "Texto de la nota" }))).toBe(true);
  });
});

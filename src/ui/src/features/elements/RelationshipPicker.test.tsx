// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Relationship } from "../../bridge/generated/protocol";
import { RelationshipPicker, type RelationshipPickerProps } from "./RelationshipPicker";

const onChoose = vi.fn();
const onCancel = vi.fn();
const childOf: Relationship = {
  id: "r",
  from: "c",
  to: "a",
  kind: "builtin:child-of",
  starts: null,
  ends: null,
};

function show(props: Partial<RelationshipPickerProps> = {}) {
  render(
    <RelationshipPicker
      from={{ id: "c", name: "Claudio" }}
      to={{ id: "a", name: "Antonio" }}
      relationships={[]}
      ownKinds={[{ id: "own:1", forward: "maestro de", inverse: "discípulo de" }]}
      onChoose={onChoose}
      onCancel={onCancel}
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  onChoose.mockReset();
  onCancel.mockReset();
});

describe("choosing how two fichas relate", () => {
  it("reads from the first ficha, with the kinds of the work first", async () => {
    const user = userEvent.setup();
    show();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Claudio es… Antonio");
    expect(screen.getByRole("searchbox")).toHaveFocus();
    const groups = screen.getAllByRole("heading", { level: 3 }).map((title) => title.textContent);
    expect(groups).toEqual(["De esta obra", "Comunes"]);

    await user.click(screen.getByRole("button", { name: "padre de" }));
    expect(onChoose).toHaveBeenCalledWith({ kind: "builtin:child-of", swap: true });
  });

  it("finds a kind as the writer types, and Intro takes the first", async () => {
    const user = userEvent.setup();
    show();

    await user.type(screen.getByRole("searchbox"), "VIVE{Enter}");

    expect(screen.queryByRole("button", { name: "hijo de" })).not.toBeInTheDocument();
    expect(onChoose).toHaveBeenCalledWith({ kind: "builtin:lives-in", swap: false });
  });

  it("does not offer what they already are", () => {
    show({ relationships: [childOf] });

    expect(screen.getByRole("button", { name: "hijo de" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "padre de" })).toBeEnabled();
  });

  it("writes a new pair, symmetric when the other side is empty", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByRole("searchbox"), "vecino de");

    await user.click(screen.getByRole("button", { name: "Nueva…" }));
    const forward = screen.getByRole("textbox", { name: "Cómo se lee: Claudio … Antonio" });
    expect(forward).toHaveValue("vecino de");
    expect(forward).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Relacionar" }));

    expect(onChoose).toHaveBeenCalledWith({ newKind: { forward: "vecino de", inverse: null } });
  });

  it("marks the kind of a relationship being changed, and offers to remove it", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    show({ relationships: [childOf], changing: childOf, onRemove });

    expect(screen.getByRole("button", { name: "hijo de" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Quitar la relación" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("goes back from «Nueva…» with Escape, and closes with the next one", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Nueva…" }));

    await user.keyboard("{Escape}");
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});

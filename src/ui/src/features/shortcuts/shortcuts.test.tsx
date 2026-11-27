// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { SHORTCUTS, eventOf, isHelpShortcut, keyLabel } from "./table";

afterEach(cleanup);

describe("the shortcuts of Rocinante", () => {
  it("say the keys the app really answers to", () => {
    const checked = SHORTCUTS.flatMap((group) => group.shortcuts).filter(
      (shortcut) => shortcut.check,
    );
    expect(checked.length).toBeGreaterThan(10);
    for (const shortcut of checked) {
      expect(shortcut.check!(eventOf(shortcut.keys)), shortcut.keys.join("+")).toBe(true);
    }
    expect(isHelpShortcut(new KeyboardEvent("keydown", { key: "F1", ctrlKey: true }))).toBe(false);
  });

  it("write the keys as each system does", () => {
    expect(["Mod", "Shift", "Alt", "Enter", "F9"].map((key) => keyLabel(key, false))).toEqual([
      "Ctrl",
      "Mayús",
      "Alt",
      "Intro",
      "F9",
    ]);
    expect(["Mod", "Shift", "Alt"].map((key) => keyLabel(key, true))).toEqual(["⌘", "⇧", "⌥"]);
  });

  it("are shown grouped, and Escape or F1 closes them", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsDialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Teclas rápidas" });
    expect(within(dialog).getByRole("region", { name: "Vistas" })).toHaveTextContent(
      "Exportar la obra",
    );
    expect(within(dialog).getByRole("region", { name: "Paneles" })).toHaveTextContent("Fichas");
    await user.keyboard("{Escape}");
    await user.keyboard("{F1}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidePanelTabs } from "./SidePanelTabs";

afterEach(cleanup);

describe("the tabs of the panel beside the text", () => {
  it("shows which face is open, and changes face with a click or the arrows", async () => {
    const user = userEvent.setup();
    const onShow = vi.fn();
    render(<SidePanelTabs tab="elements" onShow={onShow} />);

    const elements = screen.getByRole("tab", { name: "Fichas" });
    expect(elements).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Notas" })).toHaveAttribute("aria-selected", "false");

    await user.click(screen.getByRole("tab", { name: "Notas" }));
    expect(onShow).toHaveBeenLastCalledWith("notes");

    elements.focus();
    await user.keyboard("{ArrowRight}");
    expect(onShow).toHaveBeenLastCalledWith("notes");
    await user.keyboard("{Home}");
    expect(onShow).toHaveBeenLastCalledWith("elements");
  });
});

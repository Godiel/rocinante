// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTabShortcut, isThreadsShortcut } from "./shortcuts";
import { useWorkspaceTab } from "./useWorkspaceTab";
import { WorkspaceTabs } from "./WorkspaceTabs";

const onBackToWriting = vi.fn();

/** The tabs over the two views, as the work shows them. */
function Workspace({ focused = false }: { focused?: boolean }) {
  const workspace = useWorkspaceTab({ focused, onBackToWriting });
  return (
    <>
      <WorkspaceTabs tab={workspace.tab} onShow={workspace.show} />
      <div hidden={workspace.tab !== "writing"}>
        <p>El texto</p>
        <div data-own-keys="">
          <p>Descripción</p>
        </div>
      </div>
      {workspace.boardVisited && <p hidden={workspace.tab !== "board"}>La pizarra</p>}
      {workspace.threadsVisited && <p hidden={workspace.tab !== "threads"}>Los hilos</p>}
    </>
  );
}

function pressF2(target: Element | Window = window) {
  return fireEvent.keyDown(target, { key: "F2" });
}

// jsdom does not scroll: the root of the app, which scrolls the page, only keeps where it was put.
let root: HTMLElement;
beforeEach(() => {
  root = document.createElement("div");
  root.id = "root";
  let top = 0;
  Object.defineProperty(root, "scrollTop", {
    get: () => top,
    set: (value: number) => {
      top = value;
    },
    configurable: true,
  });
  document.body.append(root);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  root.remove();
  onBackToWriting.mockReset();
});

describe("the tabs of the work", () => {
  it("starts on the writing, and loads the board only when asked for", () => {
    render(<Workspace />);

    expect(screen.getByRole("tab", { name: "Escritura" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("La pizarra")).not.toBeInTheDocument();
  });

  it("goes from one to the other with F2, keeping the writing in place", () => {
    render(<Workspace />);
    const text = screen.getByText("El texto");

    pressF2();
    expect(screen.getByRole("tab", { name: "Tablero" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("La pizarra")).toBeVisible();
    expect(text).not.toBeVisible();

    pressF2();
    expect(screen.getByText("El texto")).toBe(text);
    expect(text).toBeVisible();
    expect(screen.getByText("La pizarra")).not.toBeVisible();
    expect(onBackToWriting).toHaveBeenCalledOnce();
  });

  it("brings the page back to where it was scrolled", () => {
    render(<Workspace />);
    root.scrollTop = 900;

    pressF2();
    expect(root.scrollTop).toBe(0);
    pressF2();

    expect(root.scrollTop).toBe(900);
  });

  it("does nothing with F2 in focus mode", () => {
    render(<Workspace focused />);

    const event = pressF2();

    expect(event).toBe(false);
    expect(screen.getByRole("tab", { name: "Escritura" })).toHaveAttribute("aria-selected", "true");
  });

  it("leaves F2 alone where the writer types a ficha's description", () => {
    render(<Workspace />);

    pressF2(screen.getByText("Descripción"));

    expect(screen.getByRole("tab", { name: "Escritura" })).toHaveAttribute("aria-selected", "true");
  });

  it("is a list of tabs that clicks and the arrows go through", async () => {
    const user = userEvent.setup();
    render(<Workspace />);

    await user.click(screen.getByRole("tab", { name: "Tablero" }));
    expect(screen.getByRole("tab", { name: "Tablero" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Hilos" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    const writing = screen.getByRole("tab", { name: "Escritura" });
    expect(writing).toHaveAttribute("aria-selected", "true");
    expect(writing).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Tablero" })).toHaveAttribute("tabindex", "-1");
  });

  it("goes to the threads and back with F8, and from the threads F2 goes back to the writing", () => {
    render(<Workspace />);
    const text = screen.getByText("El texto");

    fireEvent.keyDown(window, { key: "F8" });
    expect(screen.getByRole("tab", { name: "Hilos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Los hilos")).toBeVisible();
    expect(text).not.toBeVisible();

    fireEvent.keyDown(window, { key: "F8" });
    expect(text).toBeVisible();

    fireEvent.keyDown(window, { key: "F8" });
    pressF2();
    expect(text).toBeVisible();
    expect(screen.getByRole("tab", { name: "Hilos" })).toHaveAttribute("title", "Hilos (F8)");
    expect(isThreadsShortcut(new KeyboardEvent("keydown", { key: "F8", altKey: true }))).toBe(
      false,
    );
  });

  it("answers to a plain F2 only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);
    expect(isTabShortcut(key({ key: "F2" }))).toBe(true);
    expect(isTabShortcut(key({ key: "F2", ctrlKey: true }))).toBe(false);
    expect(isTabShortcut(key({ key: "F2", shiftKey: true }))).toBe(false);
  });

  it("goes back to the writing when asked, as focus mode does", () => {
    function Asked() {
      const workspace = useWorkspaceTab({ focused: false, onBackToWriting });
      return (
        <>
          <WorkspaceTabs tab={workspace.tab} onShow={workspace.show} />
          <button onClick={() => workspace.show("writing")}>Concentración</button>
        </>
      );
    }
    render(<Asked />);
    pressF2();

    act(() => screen.getByRole("button", { name: "Concentración" }).click());

    expect(screen.getByRole("tab", { name: "Escritura" })).toHaveAttribute("aria-selected", "true");
  });
});

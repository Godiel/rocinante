// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusBar, HIDE_AFTER_MS, REVEAL_EDGE_PX } from "./FocusBar";
import type { FocusWindow } from "./focus-window";
import { isFocusShortcut, isLeaveFocusKey } from "./shortcuts";
import { useFocusMode } from "./useFocusMode";

afterEach(cleanup);

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("focus shortcuts", () => {
  it("F11 alone goes in and out", () => {
    expect(isFocusShortcut(key({ key: "F11" }))).toBe(true);
    expect(isFocusShortcut(key({ key: "F11", ctrlKey: true }))).toBe(false);
    expect(isFocusShortcut(key({ key: "F5" }))).toBe(false);
  });

  it("Escape alone leaves", () => {
    expect(isLeaveFocusKey(key({ key: "Escape" }))).toBe(true);
    expect(isLeaveFocusKey(key({ key: "Escape", shiftKey: true }))).toBe(false);
  });
});

/** A window that remembers what it was asked and lets the test resize it. */
function fakeWindow() {
  let full = false;
  const resized = new Set<() => void>();
  const window: FocusWindow = {
    setFullscreen: vi.fn((on: boolean) => {
      full = on;
      return Promise.resolve();
    }),
    isFullscreen: () => Promise.resolve(full),
    onResized: (changed) => {
      resized.add(changed);
      return Promise.resolve(() => resized.delete(changed));
    },
  };
  return {
    window,
    /** The system takes the window out of full screen, as its own key or button does. */
    leaveFromSystem() {
      full = false;
      resized.forEach((changed) => changed());
    },
  };
}

function Harness(props: Parameters<typeof useFocusMode>[0]) {
  const focus = useFocusMode(props);
  return (
    <div>
      <p>{focus.focused ? "concentrado" : "normal"}</p>
      <div className="book-page">
        <div
          className="ProseMirror"
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          onKeyDown={(event) => {
            // As ProseMirror does with every Escape in the text, though it does nothing with it.
            if (event.key === "Escape") event.preventDefault();
          }}
        >
          En un lugar de la Mancha
        </div>
      </div>
      <input
        aria-label="nota"
        onKeyDown={(event) => {
          // As a note being written does: Escape is its own.
          if (event.key === "Escape") event.preventDefault();
        }}
      />
      <button onClick={focus.leave}>salir</button>
    </div>
  );
}

describe("focus mode", () => {
  let fake: ReturnType<typeof fakeWindow>;
  let onEnter: ReturnType<typeof vi.fn<() => void>>;
  let onLeave: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fake = fakeWindow();
    onEnter = vi.fn<() => void>();
    onLeave = vi.fn<() => void>();
  });

  const show = () => render(<Harness window={fake.window} onEnter={onEnter} onLeave={onLeave} />);

  it("F11 goes full screen and back", async () => {
    show();

    await userEvent.keyboard("{F11}");
    expect(screen.getByText("concentrado")).toBeInTheDocument();
    expect(onEnter).toHaveBeenCalledOnce();
    expect(fake.window.setFullscreen).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard("{F11}");
    expect(screen.getByText("normal")).toBeInTheDocument();
    expect(onLeave).toHaveBeenCalledOnce();
    expect(fake.window.setFullscreen).toHaveBeenLastCalledWith(false);
  });

  it("Escape leaves, unless something smaller on the page took it", async () => {
    show();
    await userEvent.keyboard("{F11}");

    await userEvent.click(screen.getByLabelText("nota"));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByText("concentrado")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByText("En un lugar de la Mancha"), { key: "Escape" });
    expect(screen.getByText("normal")).toBeInTheDocument();
  });

  it("Escape first lets go of a selection in the text, which hides its toolbar", async () => {
    show();
    await userEvent.keyboard("{F11}");
    const text = screen.getByText("En un lugar de la Mancha");
    document.getSelection()!.selectAllChildren(text);

    fireEvent.keyDown(text, { key: "Escape" });
    expect(document.getSelection()!.isCollapsed).toBe(true);
    expect(screen.getByText("concentrado")).toBeInTheDocument();

    fireEvent.keyDown(text, { key: "Escape" });
    expect(screen.getByText("normal")).toBeInTheDocument();
  });

  it("Escape does nothing outside focus mode", async () => {
    show();

    await userEvent.keyboard("{Escape}");

    expect(onEnter).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("leaving full screen from the system leaves the mode without asking the window again", async () => {
    show();
    await userEvent.keyboard("{F11}");
    await act(async () => {});

    await act(async () => fake.leaveFromSystem());

    expect(screen.getByText("normal")).toBeInTheDocument();
    expect(onLeave).toHaveBeenCalledOnce();
    expect(fake.window.setFullscreen).toHaveBeenCalledTimes(1);
  });

  it("a window that cannot go full screen still gives the mode, and says why", async () => {
    const onProblem = vi.fn();
    vi.mocked(fake.window.setFullscreen).mockRejectedValueOnce(new Error("sin permiso"));
    render(
      <Harness window={fake.window} onEnter={onEnter} onLeave={onLeave} onProblem={onProblem} />,
    );

    await userEvent.keyboard("{F11}");
    await act(async () => {});

    expect(screen.getByText("concentrado")).toBeInTheDocument();
    expect(onProblem).toHaveBeenCalledOnce();
  });

  it("closing the view in focus mode gives the window back", async () => {
    const view = show();
    await userEvent.keyboard("{F11}");

    view.unmount();

    expect(fake.window.setFullscreen).toHaveBeenLastCalledWith(false);
  });
});

describe("the minimal bar", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const bar = () => screen.getByRole("toolbar", { hidden: true });

  it("is hidden until the pointer reaches the top edge", () => {
    render(<FocusBar words={1234} onLeave={() => {}} />);
    expect(bar()).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerMove(document.body, { clientY: 200 });
    expect(bar()).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerMove(document.body, { clientY: REVEAL_EDGE_PX });
    expect(bar()).toHaveAttribute("aria-hidden", "false");
    expect(bar()).toHaveTextContent("1.234 palabras");
  });

  it("goes away when the writer types again or leaves it alone", () => {
    render(<FocusBar words={1} onLeave={() => {}} />);

    fireEvent.pointerMove(document.body, { clientY: 0 });
    fireEvent.keyDown(document.body, { key: "a" });
    expect(bar()).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerMove(document.body, { clientY: 0 });
    fireEvent.pointerMove(document.body, { clientY: 300 });
    act(() => void vi.advanceTimersByTime(HIDE_AFTER_MS - 1));
    expect(bar()).toHaveAttribute("aria-hidden", "false");
    act(() => void vi.advanceTimersByTime(1));
    expect(bar()).toHaveAttribute("aria-hidden", "true");
  });

  it("stays while the pointer is on it, and its button leaves the mode", async () => {
    const onLeave = vi.fn();
    render(<FocusBar words={1} onLeave={onLeave} />);
    fireEvent.pointerMove(document.body, { clientY: 0 });
    const leave = screen.getByRole("button", { name: "Salir" });

    fireEvent.pointerMove(leave, { clientY: 30 });
    act(() => void vi.advanceTimersByTime(HIDE_AFTER_MS * 2));
    expect(bar()).toHaveAttribute("aria-hidden", "false");
    expect(bar()).toHaveTextContent("1 palabra");

    fireEvent.click(leave);
    expect(onLeave).toHaveBeenCalledOnce();
  });
});

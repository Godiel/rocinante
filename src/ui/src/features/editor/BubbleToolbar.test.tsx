// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The floating menu places itself over a visible selection, which jsdom has not: here it is always shown.
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { BubbleToolbar } from "./BubbleToolbar";

function editorWith(html: string, from: number, to: number): Editor {
  const editor = new Editor({ extensions: [StarterKit], content: html });
  editor.commands.setTextSelection({ from, to });
  return editor;
}

afterEach(cleanup);

describe("making a ficha from the text", () => {
  it("names it after the selection, on one line, and leaves the text as it was", () => {
    const editor = editorWith("<p>Llegó don Quijote a la venta.</p>", 7, 18);
    const before = editor.getHTML();
    const onCreateElement = vi.fn();
    render(
      <BubbleToolbar
        editor={editor}
        onNote={vi.fn()}
        onFootnote={vi.fn()}
        onCreateElement={onCreateElement}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear ficha con este nombre" }));

    expect(onCreateElement).toHaveBeenCalledWith("don Quijote");
    expect(editor.getHTML()).toBe(before);
    editor.destroy();
  });

  it("is not offered where there are no fichas to make", () => {
    const editor = editorWith("<p>Rocinante</p>", 1, 5);
    render(<BubbleToolbar editor={editor} onNote={vi.fn()} onFootnote={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Crear ficha con este nombre" })).toBeNull();
    editor.destroy();
  });
});

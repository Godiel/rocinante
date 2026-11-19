// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Counter, type CounterProps } from "./Counter";

function renderCounter(overrides: Partial<CounterProps> = {}) {
  const props: CounterProps = {
    document: { words: 1240, characters: 7012, paragraphs: 38 },
    kind: "chapter",
    work: { words: 48310, characters: 271904, paragraphs: 1502 },
    chapters: 12,
    save: { kind: "saved" },
    visible: true,
    onHide: vi.fn(),
    ...overrides,
  };
  const view = render(<Counter {...props} />);
  return { ...props, view, user: userEvent.setup() };
}

describe("the counter", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows one quiet line with the words of the chapter and of the work", () => {
    renderCounter();

    expect(screen.getByRole("button", { expanded: false })).toHaveTextContent(
      "1.240 palabras · obra 48.310",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("opens into the full table on hover or with a click", async () => {
    const { user } = renderCounter();

    await user.hover(screen.getByRole("complementary", { name: "Contador" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    await user.unhover(screen.getByRole("complementary", { name: "Contador" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.keyboard("{Tab}{Enter}");
    const rows = screen.getAllByRole("row").map((row) => row.textContent);
    expect(rows).toEqual([
      "CapítuloObra",
      "Palabras1.24048.310",
      "Caracteres7.012271.904",
      "Párrafos381.502",
      "Capítulos12",
      "Ocultar contador",
    ]);
  });

  it("names the column after what is open", async () => {
    const { user } = renderCounter({ kind: "fragment" });

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByRole("columnheader", { name: "Fragmento" })).toBeInTheDocument();
  });

  it("says one word in the singular", () => {
    renderCounter({ document: { words: 1, characters: 4, paragraphs: 1 } });
    expect(screen.getByRole("button")).toHaveTextContent("1 palabra ·");
  });

  it("fades while the writer types and hides when asked", async () => {
    const { onHide, view, user } = renderCounter({ save: { kind: "typing" } });

    expect(screen.getByRole("complementary")).toHaveClass("counter-quiet");

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Ocultar contador" }));
    expect(onHide).toHaveBeenCalled();

    view.rerender(
      <Counter
        document={null}
        kind="chapter"
        work={{ words: 0, characters: 0, paragraphs: 0 }}
        chapters={0}
        save={{ kind: "saved" }}
        visible={false}
        onHide={onHide}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says nothing about saving unless it is slow or fails, even when hidden", () => {
    const { view } = renderCounter({ save: { kind: "saving" } });
    expect(screen.getByRole("status")).toHaveTextContent("Guardando…");

    view.rerender(
      <Counter
        document={null}
        kind="chapter"
        work={{ words: 0, characters: 0, paragraphs: 0 }}
        chapters={0}
        save={{ kind: "failed", message: "El disco está lleno." }}
        visible={false}
        onHide={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo guardar. El disco está lleno. Se volverá a intentar.",
    );
  });
});

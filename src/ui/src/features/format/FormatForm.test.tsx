// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkFormat } from "../../bridge/generated/protocol";
import { FormatForm } from "./FormatForm";

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

function renderForm(value: WorkFormat = novel) {
  const onChange = vi.fn<(format: WorkFormat) => void>();
  const view = render(<FormatForm value={value} onChange={onChange} />);
  return { onChange, view, user: userEvent.setup() };
}

const last = (onChange: ReturnType<typeof renderForm>["onChange"]) => onChange.mock.lastCall?.[0];

describe("format form", () => {
  afterEach(() => cleanup());

  it("shows the format in the units of its page size, with a decimal comma", () => {
    renderForm();

    expect(screen.getByLabelText("Tamaño")).toHaveValue("a5");
    expect(screen.getByLabelText("Centímetros")).toBeChecked();
    expect(screen.getByLabelText("Margen superior")).toHaveValue("1,8");
    expect(screen.getByLabelText("Margen interior (lomo)")).toHaveValue("2");
    expect(screen.getByLabelText("Cuerpo")).toHaveValue("11");
    expect(screen.getByLabelText("Interlineado")).toHaveValue("1,35");
    expect(screen.queryByLabelText("Ancho")).not.toBeInTheDocument();
  });

  it("picking a size proposes its printer's margins and its unit", async () => {
    const { onChange, user } = renderForm();

    await user.selectOptions(screen.getByLabelText("Tamaño"), "trade");

    expect(last(onChange)).toMatchObject({
      pageSize: "trade",
      pageWidth: 152.4,
      pageHeight: 228.6,
      margins: { top: 19, bottom: 23, inside: 22, outside: 16 },
    });
    expect(screen.getByLabelText("Pulgadas")).toBeChecked();
    expect(screen.getByLabelText("Margen superior")).toHaveValue("0,75");
  });

  it("a size of its own is typed in centimetres or inches and kept in millimetres", async () => {
    const { onChange, user } = renderForm();

    await user.selectOptions(screen.getByLabelText("Tamaño"), "custom");
    const width = screen.getByLabelText("Ancho");
    await user.clear(width);
    await user.type(width, "13,5");

    expect(last(onChange)).toMatchObject({ pageSize: "custom", pageWidth: 135, pageHeight: 210 });

    await user.click(screen.getByLabelText("Pulgadas"));
    expect(screen.getByLabelText("Ancho")).toHaveValue("5,31");
  });

  it("a margin can be changed on its own and the size stays", async () => {
    const { onChange, user } = renderForm();

    const outside = screen.getByLabelText("Margen exterior");
    await user.clear(outside);
    await user.type(outside, "1.2");

    expect(last(onChange)).toMatchObject({ pageSize: "a5", margins: { outside: 12 } });
  });

  it("an impossible value is said in its field and not sent", async () => {
    const { onChange, user } = renderForm();

    const body = screen.getByLabelText("Cuerpo");
    await user.clear(body);
    await user.type(body, "30");

    expect(body).toHaveAttribute("aria-invalid", "true");
    expect(body).toHaveAccessibleDescription("Entre 8 y 16 puntos.");
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ bodySize: 30 }));

    await user.clear(body);
    await user.type(body, "doce");
    expect(body).toHaveAccessibleDescription("Escribe un número.");
  });

  it("says when the margins leave no room for the text", async () => {
    const { onChange, user } = renderForm();

    const inside = screen.getByLabelText("Margen interior (lomo)");
    await user.clear(inside);
    await user.type(inside, "11");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Los márgenes no dejan sitio al texto: debe quedar al menos una caja de 4 × 6 cm.",
    );
    // «1» on the way to «11» was fine; «11» is not sent.
    expect(last(onChange)?.margins.inside).toBe(10);
  });

  it("changes the type and the paragraphs at once", async () => {
    const { onChange, user } = renderForm();

    await user.selectOptions(screen.getByLabelText("Tipografía"), "courierPrime");
    expect(last(onChange)).toMatchObject({ typeface: "courierPrime" });

    await user.click(screen.getByLabelText("Alineado a la izquierda"));
    await user.click(screen.getByLabelText("Sangría en la primera línea"));
    await user.click(screen.getByLabelText("Capitular al empezar cada capítulo"));

    expect(last(onChange)).toMatchObject({
      typeface: "courierPrime",
      justified: false,
      firstLineIndent: false,
      dropCap: true,
    });
  });

  it("follows a change made in another window, but not over the field being typed in", async () => {
    const { view, user } = renderForm();
    const leading = screen.getByLabelText("Interlineado");
    await user.clear(leading);
    await user.type(leading, "1,");

    view.rerender(
      <FormatForm value={{ ...novel, bodySize: 12, leading: 1.5 }} onChange={() => {}} />,
    );

    expect(screen.getByLabelText("Cuerpo")).toHaveValue("12");
    expect(leading).toHaveValue("1,");
  });
});

// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => new Map<string, (params: unknown) => void>());
const invoke = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
  onNotification: (name: string, handler: (params: unknown) => void) => {
    listeners.set(name, handler);
    return Promise.resolve(() => {
      if (listeners.get(name) === handler) listeners.delete(name);
    });
  },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { ExportDialog } from "./ExportDialog";
import { defaultCredits, fileName } from "./formats";

const origin = "main";

function show(overrides: { chooseExportPath?: () => Promise<string | null> } = {}) {
  const props = {
    title: "La venta: primera parte",
    origin,
    beforeExport: vi.fn(() => Promise.resolve()),
    chooseExportPath: vi.fn(
      overrides.chooseExportPath ?? (() => Promise.resolve("/libros/La venta.pdf")),
    ),
    chooseImage: vi.fn(() => Promise.resolve(null)),
    onClose: vi.fn(),
  };
  render(<ExportDialog {...props} />);
  return props;
}

function notify(name: string, params: unknown) {
  act(() => listeners.get(name)?.(params));
}

beforeEach(() => {
  request.mockReset();
  listeners.clear();
  invoke.mockClear();
  request.mockImplementation((method: string) =>
    Promise.resolve(
      method === "book.get"
        ? { author: "Miguel de Cervantes", credits: null, cover: null }
        : method === "export.run"
          ? { exportId: "e1" }
          : null,
    ),
  );
});
afterEach(cleanup);

describe("exporting the work", () => {
  it("names the file after the title and offers the default credits", () => {
    expect(fileName("La venta: primera parte", "pdf")).toBe("La venta primera parte.pdf");
    expect(fileName("  ", "md")).toBe("Obra.md");
    expect(defaultCredits("Ana", 2026)).toBe("© 2026 Ana. Todos los derechos reservados.");
    expect(defaultCredits("", 2026)).toBe("© 2026. Todos los derechos reservados.");
  });

  it("asks where to save, exports in the background and shows the book in its folder", async () => {
    const user = userEvent.setup();
    const props = show();

    expect(await screen.findByDisplayValue("Miguel de Cervantes")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Word/ }));
    await user.click(screen.getByRole("checkbox", { name: "Índice" }));
    await user.click(screen.getByRole("button", { name: "Exportar…" }));

    expect(props.chooseExportPath).toHaveBeenCalledWith("La venta primera parte.docx", {
      name: "Documento de Word",
      extension: "docx",
    });
    expect(props.beforeExport).toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("export.run", {
      format: "docx",
      parts: { cover: true, credits: true, contents: false },
      path: "/libros/La venta.pdf",
      origin,
    });

    notify("export.progress", { exportId: "otra", done: 9, total: 9, origin });
    notify("export.progress", { exportId: "e1", done: 1, total: 3, origin });
    expect(screen.getByRole("status")).toHaveTextContent("Exportando… 1 de 3 capítulos.");
    notify("export.finished", {
      exportId: "e1",
      path: "/libros/La venta.pdf",
      bytes: 10,
      reason: null,
      origin,
    });
    expect(screen.getByText(/Listo: el libro está en «La venta.pdf»/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mostrar en la carpeta" }));
    expect(invoke).toHaveBeenCalledWith("reveal_file", { path: "/libros/La venta.pdf" });
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("keeps the author and the credits in the work", async () => {
    const user = userEvent.setup();
    show();

    const author = await screen.findByLabelText("Autor");
    await user.clear(author);
    await user.type(author, "Cide Hamete");
    await user.click(screen.getByLabelText("Créditos"));
    expect(request).toHaveBeenCalledWith("book.update", {
      changes: { author: "Cide Hamete" },
      origin,
    });
    expect(screen.getByLabelText("Créditos")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/Cide Hamete\. Todos los derechos reservados\./),
    );
    await user.type(screen.getByLabelText("Créditos"), "Primera edición.");
    await user.click(screen.getByLabelText("Autor"));
    expect(request).toHaveBeenCalledWith("book.update", {
      changes: { credits: "Primera edición." },
      origin,
    });
  });

  it("offers a cover image only for EPUB", async () => {
    const user = userEvent.setup();
    show();

    expect(screen.queryByText("Imagen de portada")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /EPUB/ }));
    expect(screen.getByRole("button", { name: "Elegir imagen" })).toBeInTheDocument();
  });

  it("does nothing if the writer does not choose where, and says calmly why it failed", async () => {
    const user = userEvent.setup();
    show({ chooseExportPath: () => Promise.resolve(null) });

    await user.click(screen.getByRole("button", { name: "Exportar…" }));
    expect(request).not.toHaveBeenCalledWith("export.run", expect.anything());
    cleanup();

    show();
    await user.click(screen.getByRole("button", { name: "Exportar…" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("export.run", expect.anything()));
    notify("export.finished", {
      exportId: "e1",
      path: null,
      bytes: 0,
      reason: "exportFailed",
      origin,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/No se pudo exportar/);
    await user.click(screen.getByRole("button", { name: "Volver a intentarlo" }));
    expect(screen.getByRole("button", { name: "Exportar…" })).toBeInTheDocument();
  });
});

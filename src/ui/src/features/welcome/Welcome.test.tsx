// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecentProject, WorkFormat } from "../../bridge/generated/protocol";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request,
}));

import { CoreError } from "../../bridge/core";
import { ErrorCodes } from "../../bridge/generated/protocol";
import { Welcome, type Pickers } from "./Welcome";

const FOLDER = "C:\\Users\\autor\\Documents\\Rocinante";
const today = new Date().toISOString();

const trade: WorkFormat = {
  pageSize: "trade",
  pageWidth: 152.4,
  pageHeight: 228.6,
  margins: { top: 19, bottom: 23, inside: 22, outside: 16 },
  typeface: "literata",
  bodySize: 10.5,
  leading: 1.4,
  firstLineIndent: true,
  justified: true,
  dropCap: true,
};

const quijote: RecentProject = {
  path: `${FOLDER}\\Don Quijote.rocinante`,
  title: "Don Quijote de la Mancha",
  lastOpenedAt: today,
  exists: true,
};
const lost: RecentProject = {
  path: "D:\\Viejo\\Novelas ejemplares.rocinante",
  title: "Novelas ejemplares",
  lastOpenedAt: "2024-05-01T10:00:00+00:00",
  exists: false,
};

function renderWelcome(
  options: { recent?: RecentProject[]; notice?: string | null; pickers?: Partial<Pickers> } = {},
) {
  const pickers: Pickers = {
    chooseFolder: vi.fn(() => Promise.resolve(null)),
    chooseProject: vi.fn(() => Promise.resolve(null)),
    ...options.pickers,
  };
  render(
    <Welcome
      recent={options.recent ?? [quijote, lost]}
      defaultFolder={FOLDER}
      suggestedFormat={trade}
      notice={options.notice ?? null}
      origin="main"
      pickers={pickers}
    />,
  );
  return { pickers, user: userEvent.setup() };
}

describe("welcome screen", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockImplementation(() => Promise.resolve(null));
  });

  afterEach(() => {
    cleanup();
  });

  it("lists recent projects, most recent first, saying when each was opened", () => {
    renderWelcome();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Don Quijote de la Mancha");
    expect(rows[0]).toHaveTextContent("hoy");
    expect(rows[1]).toHaveTextContent("no se encuentra");
  });

  it("opens a recent project on click", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: /Don Quijote/ }));

    expect(request).toHaveBeenCalledWith("project.open", { path: quijote.path, origin: "main" });
  });

  it("offers to remove a project whose file is gone, without touching any file", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: /Novelas ejemplares/ }));
    expect(screen.getByRole("status")).toHaveTextContent("No se encuentra en D:\\Viejo.");
    await user.click(screen.getByRole("button", { name: "Quitar de la lista" }));

    expect(request).toHaveBeenCalledWith("recent.remove", { path: lost.path, origin: "main" });
    expect(request).not.toHaveBeenCalledWith("project.open", expect.anything());
  });

  it("opens a project chosen in the system dialog, and does nothing if cancelled", async () => {
    const chooseProject = vi
      .fn<Pickers["chooseProject"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("E:\\Obras\\La Galatea.rocinante");
    const { user } = renderWelcome({ pickers: { chooseProject } });

    await user.click(screen.getByRole("button", { name: "Abrir proyecto" }));
    expect(request).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Abrir proyecto" }));

    expect(chooseProject).toHaveBeenCalledWith(FOLDER);
    expect(request).toHaveBeenCalledWith("project.open", {
      path: "E:\\Obras\\La Galatea.rocinante",
      origin: "main",
    });
  });

  it("creates a project in Documentos/Rocinante named after its title", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "  El licenciado: Vidriera ");
    expect(screen.getByText(`${FOLDER}\\El licenciado Vidriera.rocinante`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir" }));
    await user.click(screen.getByRole("button", { name: "Omitir" }));

    expect(request).toHaveBeenCalledWith("project.create", {
      path: `${FOLDER}\\El licenciado Vidriera.rocinante`,
      title: "El licenciado: Vidriera",
      origin: "main",
    });
  });

  it("lets the writer choose another folder", async () => {
    const chooseFolder = vi.fn<Pickers["chooseFolder"]>().mockResolvedValue("E:\\Obras");
    const { user } = renderWelcome({ pickers: { chooseFolder } });

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "La Galatea");
    await user.click(screen.getByRole("button", { name: "Elegir otra carpeta" }));
    await user.click(screen.getByRole("button", { name: "Seguir" }));
    await user.click(screen.getByRole("button", { name: "Crear con este formato" }));

    expect(chooseFolder).toHaveBeenCalledWith(FOLDER);
    expect(request).toHaveBeenCalledWith("project.create", {
      path: "E:\\Obras\\La Galatea.rocinante",
      title: "La Galatea",
      format: trade,
      origin: "main",
    });
  });

  it("asks for a title before creating anything", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "   ");
    await user.click(screen.getByRole("button", { name: "Seguir" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un título.");
    expect(screen.getByLabelText("Título de la obra")).toHaveAttribute("aria-invalid", "true");
    expect(request).not.toHaveBeenCalled();
  });

  it("explains in Spanish why the core refused, and the writer can go back", async () => {
    request.mockImplementation(() =>
      Promise.reject(new CoreError(ErrorCodes.ProjectFileProblem, "exists", "alreadyExists")),
    );
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "Don Quijote");
    await user.click(screen.getByRole("button", { name: "Seguir" }));
    await user.click(screen.getByRole("button", { name: "Omitir" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya hay un archivo con ese nombre");
    await user.click(screen.getByRole("button", { name: "Volver" }));
    expect(screen.getByLabelText("Título de la obra")).toHaveValue("Don Quijote");
    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
  });

  it("after the title, offers the format filled in with the suggestion", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "Persiles{Enter}");

    expect(screen.getByRole("heading", { name: "Formato de «Persiles»" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tamaño")).toHaveValue("trade");
    expect(screen.getByLabelText("Tipografía")).toHaveValue("literata");
    expect(screen.getByLabelText("Capitular al empezar cada capítulo")).toBeChecked();
    expect(request).not.toHaveBeenCalled();
  });

  it("creates the work with the format the writer set up", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "Persiles{Enter}");
    await user.selectOptions(screen.getByLabelText("Tamaño"), "pocket");
    await user.selectOptions(screen.getByLabelText("Tipografía"), "courierPrime");
    await user.click(screen.getByRole("button", { name: "Crear con este formato" }));

    expect(request).toHaveBeenCalledWith("project.create", {
      path: `${FOLDER}\\Persiles.rocinante`,
      title: "Persiles",
      format: {
        ...trade,
        pageSize: "pocket",
        pageWidth: 110,
        pageHeight: 170,
        margins: { top: 14, bottom: 18, inside: 16, outside: 12 },
        typeface: "courierPrime",
      },
      origin: "main",
    });
  });

  it("cannot create with a format that has a problem, but can skip it", async () => {
    const { user } = renderWelcome();

    await user.click(screen.getByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título de la obra"), "Persiles{Enter}");
    await user.clear(screen.getByLabelText("Cuerpo"));
    await user.type(screen.getByLabelText("Cuerpo"), "40");

    expect(screen.getByRole("button", { name: "Crear con este formato" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Omitir" }));
    expect(request).toHaveBeenCalledWith("project.create", {
      path: `${FOLDER}\\Persiles.rocinante`,
      title: "Persiles",
      origin: "main",
    });
  });

  it("shows why the last project could not be reopened", () => {
    renderWelcome({ notice: "No se pudo abrir «Don Quijote». No se encuentra el archivo." });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo abrir «Don Quijote»");
  });

  it("without recent projects, offers only the two ways in", () => {
    renderWelcome({ recent: [] });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Empezar" })).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { lastOpened } from "./dates";
import { folderOf, projectFileName, proposedPath } from "./paths";

describe("project file names", () => {
  it.each([
    ["Don Quijote de la Mancha", "Don Quijote de la Mancha.rocinante"],
    ["  El licenciado: Vidriera ", "El licenciado Vidriera.rocinante"],
    ['¿Quién? / "El Persiles"', "¿Quién El Persiles.rocinante"],
    ["Fin del capítulo...", "Fin del capítulo.rocinante"],
    ["línea\tcon\u0007control", "líneaconcontrol.rocinante"],
    ["   ", "Sin título.rocinante"],
    ["???", "Sin título.rocinante"],
  ])("«%s» becomes %s", (title, expected) => {
    expect(projectFileName(title)).toBe(expected);
  });
});

describe("proposed paths", () => {
  it("follow the separator of the folder", () => {
    expect(proposedPath("C:\\Users\\autor\\Documents\\Rocinante", "La Galatea")).toBe(
      "C:\\Users\\autor\\Documents\\Rocinante\\La Galatea.rocinante",
    );
    expect(proposedPath("/home/autor/Documentos/Rocinante/", "La Galatea")).toBe(
      "/home/autor/Documentos/Rocinante/La Galatea.rocinante",
    );
  });

  it("name the folder of a file", () => {
    expect(folderOf("D:\\Viejo\\Novelas.rocinante")).toBe("D:\\Viejo");
    expect(folderOf("/obras/galatea.rocinante")).toBe("/obras");
    expect(folderOf("suelto.rocinante")).toBe("suelto.rocinante");
  });
});

describe("last opened", () => {
  const now = new Date(2026, 2, 14, 18, 0);

  it.each([
    [new Date(2026, 2, 14, 9, 0), "hoy"],
    [new Date(2026, 2, 13, 23, 59), "ayer"],
    [new Date(2026, 0, 2, 12, 0), "2 de enero"],
    [new Date(2024, 4, 1, 12, 0), "1 de mayo de 2024"],
  ])("%s reads as «%s»", (when, expected) => {
    expect(lastOpened(when.toISOString(), now)).toBe(expected);
  });
});

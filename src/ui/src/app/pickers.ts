import { open } from "@tauri-apps/plugin-dialog";
import type { Pickers } from "../features/welcome/Welcome";

/** The operating system's own dialogs, through the Tauri dialog plugin. */
export const systemPickers: Pickers = {
  async chooseFolder(startIn) {
    const folder = await open({
      directory: true,
      defaultPath: startIn,
      title: "Carpeta del proyecto",
    });
    return typeof folder === "string" ? folder : null;
  },
  async chooseProject(startIn) {
    const file = await open({
      defaultPath: startIn,
      title: "Abrir proyecto",
      filters: [{ name: "Proyecto de Rocinante", extensions: ["rocinante"] }],
    });
    return typeof file === "string" ? file : null;
  },
  async chooseImage() {
    const file = await open({
      title: "Añadir una imagen de fondo",
      filters: [{ name: "Imagen", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    return typeof file === "string" ? file : null;
  },
  async chooseElementImage() {
    const file = await open({
      title: "Imagen de la ficha",
      filters: [{ name: "Imagen", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    return typeof file === "string" ? file : null;
  },
  async chooseSound() {
    const file = await open({
      title: "Añadir un sonido de ambiente",
      filters: [{ name: "Sonido", extensions: ["ogg", "opus", "mp3", "wav", "flac"] }],
    });
    return typeof file === "string" ? file : null;
  },
};

import { isCorrectionShortcut } from "../correction/shortcuts";
import { isElementsShortcut } from "../elements/panel";
import { isExportShortcut } from "../export/shortcuts";
import { isFocusShortcut } from "../focus/shortcuts";
import { isOutlineShortcut } from "../outline/shortcut";
import { isPageViewShortcut } from "../pages/shortcuts";
import { isSaveVersionShortcut, isVersionsShortcut } from "../versions/shortcuts";
import { isTabShortcut, isThreadsShortcut } from "../workspace/shortcuts";
import { isNotesShortcut } from "../workspace/side-panel";

/** F1 opens the list of shortcuts, as help does in almost every program. */
export function isHelpShortcut(event: KeyboardEvent): boolean {
  return event.key === "F1" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

/** A key of a shortcut: «Mod» is Ctrl, or ⌘ on a Mac. */
export type Key = "Mod" | "Shift" | "Alt" | string;

export interface Shortcut {
  keys: readonly Key[];
  /** What it does, as the writer would say it. */
  does: string;
  /** How the app recognises it, where it is the app's and not the editor's: the test checks they agree. */
  check?: (event: KeyboardEvent) => boolean;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: readonly Shortcut[];
}

/** Every shortcut of Rocinante, grouped as the writer meets them. The only list: F1 shows it. */
export const SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: "Vistas",
    shortcuts: [
      { keys: ["F1"], does: "Estas teclas rápidas", check: isHelpShortcut },
      { keys: ["F2"], does: "Pasar de la escritura al tablero y volver", check: isTabShortcut },
      { keys: ["F5"], does: "Vista de página", check: isPageViewShortcut },
      { keys: ["F6"], does: "Versiones del capítulo", check: isVersionsShortcut },
      { keys: ["F7"], does: "Mostrar u ocultar la corrección", check: isCorrectionShortcut },
      { keys: ["F8"], does: "Hilos del destino", check: isThreadsShortcut },
      { keys: ["F9"], does: "Exportar la obra", check: isExportShortcut },
      { keys: ["F11"], does: "Modo concentración", check: isFocusShortcut },
      { keys: ["Esc"], does: "Salir del modo concentración o cerrar lo abierto" },
    ],
  },
  {
    title: "Paneles",
    shortcuts: [
      { keys: ["Mod", "Shift", "I"], does: "Índice de la obra", check: isOutlineShortcut },
      { keys: ["Mod", "Shift", "E"], does: "Fichas", check: isElementsShortcut },
      { keys: ["Mod", "Shift", "N"], does: "Notas", check: isNotesShortcut },
    ],
  },
  {
    title: "Escribir",
    shortcuts: [
      { keys: ["Mod", "B"], does: "Negrita" },
      { keys: ["Mod", "I"], does: "Cursiva" },
      { keys: ["Mod", "U"], does: "Subrayado" },
      { keys: ["Mod", "Alt", "1"], does: "Título dentro del capítulo" },
      { keys: ["Mod", "Shift", "B"], does: "Cita" },
      { keys: ["Mod", "Shift", "8"], does: "Lista" },
      { keys: ["Tab"], does: "Sangrar el párrafo (Mayús + Tab para quitarla)" },
      { keys: ["Mod", "Alt", "N"], does: "Nota en el pasaje" },
      { keys: ["Mod", "Alt", "F"], does: "Nota al pie" },
      { keys: ["Mod", "Shift", "Enter"], does: "Separador de escena (o «***» y espacio)" },
      { keys: ["Mod", "Z"], does: "Deshacer" },
      { keys: ["Mod", "Shift", "Z"], does: "Rehacer" },
    ],
  },
  {
    title: "Versiones",
    shortcuts: [
      {
        keys: ["Mod", "S"],
        does: "Guardar una versión del capítulo",
        check: isSaveVersionShortcut,
      },
    ],
  },
];

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/** How a key is written for this system: ⌘, ⇧ and ⌥ on a Mac; Ctrl, Mayús and Alt elsewhere. */
export function keyLabel(key: Key, mac = MAC): string {
  switch (key) {
    case "Mod":
      return mac ? "⌘" : "Ctrl";
    case "Shift":
      return mac ? "⇧" : "Mayús";
    case "Alt":
      return mac ? "⌥" : "Alt";
    case "Enter":
      return "Intro";
    default:
      return key;
  }
}

/** The event a shortcut makes, as the browser would give it, for the test that checks the table. */
export function eventOf(keys: readonly Key[]): KeyboardEvent {
  const last = keys[keys.length - 1]!;
  const code = /^[A-Z]$/.test(last) ? `Key${last}` : /^\d$/.test(last) ? `Digit${last}` : last;
  return new KeyboardEvent("keydown", {
    key: last.length === 1 ? last.toLowerCase() : last,
    code,
    ctrlKey: keys.includes("Mod"),
    shiftKey: keys.includes("Shift"),
    altKey: keys.includes("Alt"),
  });
}

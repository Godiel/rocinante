import type { VersionSummary } from "../../bridge/generated/protocol";
import { lastOpened } from "../welcome/dates";

const time = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/** What a version is called in the list: its name, or how it came to be. */
export function versionName(version: VersionSummary): string {
  switch (version.kind) {
    case "manual":
      return version.name?.trim() || "Guardada a mano";
    case "automatic":
      return "Automática";
    case "beforeRestore":
      return "Antes de restaurar";
  }
}

/** When it was saved, as a writer would say it: «hoy, 10:42», «12 de marzo, 18:03». */
export function versionDate(version: VersionSummary, now: Date = new Date()): string {
  return `${lastOpened(version.createdAt, now)}, ${time.format(new Date(version.createdAt))}`;
}

import type { SquireSettings } from "../../bridge/generated/protocol";
import { messages } from "../../app/messages";
import { OLLAMA_HELP, providerInfo } from "./providers";

/** How the squire is doing, in a few calm words. */
export function squireStatus(settings: SquireSettings): string {
  if (!settings.provider || !settings.model) return "Sin conectar.";
  const who = `${providerInfo(settings.provider).label} · ${settings.model}`;
  switch (settings.status) {
    case "off":
      return `${who}. Apagado en esta obra.`;
    case "working":
      return `${who}. Leyendo…`;
    case "problem":
      return settings.problem === "squireUnavailable" && settings.provider === "ollama"
        ? OLLAMA_HELP
        : settings.problem
          ? messages[settings.problem]
          : "Algo no ha ido bien.";
    default:
      return `${who}. Atento a lo que escribes.`;
  }
}

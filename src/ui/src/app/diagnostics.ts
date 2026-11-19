import { invoke } from "@tauri-apps/api/core";
import { request } from "../bridge/core";
import type { DiagnosticLevel } from "../bridge/generated/protocol";

const MAX_MESSAGE = 2000;
const MAX_DETAIL = 8000;

/**
 * Takes out of an error anything that could be the writer's text. Editors quote the content they
 * choke on («Invalid content for node paragraph: "En un lugar…"»), so every quoted stretch goes,
 * and what is left is what failed and where.
 */
export function withoutText(value: string): string {
  return value
    .replace(/"(?:[^"\\]|\\.)*"/g, '"…"')
    .replace(/«[^»]*»/g, "«…»")
    .replace(/“[^”]*”/g, "“…”");
}

function cut(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** What an error says, ready for the log: no quoted text, no endless stack. */
export function describe(error: unknown): { message: string; detail: string | null } {
  if (error instanceof Error) {
    return {
      message: cut(withoutText(`${error.name}: ${error.message}`), MAX_MESSAGE),
      detail: error.stack ? cut(withoutText(error.stack), MAX_DETAIL) : null,
    };
  }
  return { message: cut(withoutText(String(error)), MAX_MESSAGE) || "Unknown error", detail: null };
}

/** Writes a problem this window saw to the app's log. Never fails: the log is not worth a crash. */
export function reportProblem(error: unknown, level: DiagnosticLevel = "error"): void {
  const { message, detail } = describe(error);
  void request("diagnostics.report", { source: "interface", level, message, detail }).catch(
    () => {},
  );
}

/** Errors nobody caught in this window go to the log too. */
export function reportUncaughtErrors(): void {
  window.addEventListener("error", (event) => reportProblem(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => reportProblem(event.reason));
}

/** Shows the folder of the log in the system's file manager. */
export function openLogFolder(): Promise<void> {
  return invoke("open_log_folder");
}

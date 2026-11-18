import { useEffect, useState } from "react";
import { ensureCompatibleCore, onNotification, request } from "../bridge/core";
import type {
  Place,
  Preferences,
  ProjectState,
  RecentProject,
  StartProblem,
} from "../bridge/generated/protocol";
import { applyTheme } from "../design/themes";
import { Welcome, type Pickers } from "../features/welcome/Welcome";
import { DevEditor } from "../features/editor/DevEditor";
import { messageFor, messages } from "./messages";

type Screen =
  | { kind: "starting" }
  | { kind: "welcome"; notice: string | null }
  | { kind: "writing"; project: ProjectState; place: Place | null }
  | { kind: "failed"; message: string };

interface AppProps {
  /** Label of this window: the origin of every change it makes. */
  origin: string;
  pickers: Pickers;
}

/** Why the project to reopen did not open, in the writer's words. */
function noticeOf(problem: StartProblem | null): string | null {
  if (!problem) return null;
  const name = problem.path.split(/[\\/]/).pop() ?? problem.path;
  return `No se pudo abrir «${name.replace(/\.rocinante$/i, "")}». ${messages[problem.reason]}`;
}

/**
 * The window: it starts as the core says (the project left open, the file the app was launched
 * with, or the welcome screen) and then follows the core's announcements, so every window shows
 * the same project.
 */
export function App({ origin, pickers }: AppProps) {
  const [screen, setScreen] = useState<Screen>({ kind: "starting" });
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [defaultFolder, setDefaultFolder] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    const applyPreferences = (next: Preferences) => {
      setPreferences(next);
      applyTheme(next.theme);
    };

    ensureCompatibleCore()
      .then(() => request("app.start", { origin }))
      .then((start) => {
        applyPreferences(start.preferences);
        setRecent(start.recent);
        setDefaultFolder(start.defaultFolder);
        setScreen(
          start.project
            ? { kind: "writing", project: start.project, place: start.place }
            : { kind: "welcome", notice: noticeOf(start.problem) },
        );
      })
      .catch((error: unknown) => setScreen({ kind: "failed", message: messageFor(error) }));

    const subscriptions = [
      onNotification("project.opened", ({ project }) => {
        void request("place.get").then((place) => setScreen({ kind: "writing", project, place }));
      }),
      onNotification("project.changed", ({ project }) =>
        setScreen((current) => (current.kind === "writing" ? { ...current, project } : current)),
      ),
      onNotification("project.closed", () => setScreen({ kind: "welcome", notice: null })),
      onNotification("recent.changed", ({ recent: next }) => setRecent(next)),
      onNotification("preferences.changed", ({ preferences: next }) => applyPreferences(next)),
    ];

    return () => {
      for (const subscription of subscriptions) void subscription.then((stop) => stop());
    };
  }, [origin]);

  switch (screen.kind) {
    case "starting":
      return null;
    case "failed":
      return (
        <p className="app-failed" role="alert">
          {screen.message}
        </p>
      );
    case "welcome":
      return (
        <Welcome
          recent={recent}
          defaultFolder={defaultFolder}
          notice={screen.notice}
          origin={origin}
          pickers={pickers}
        />
      );
    case "writing":
      return (
        <DevEditor
          key={screen.project.path}
          project={screen.project}
          place={screen.place}
          theme={preferences?.theme ?? "paper"}
          origin={origin}
        />
      );
  }
}

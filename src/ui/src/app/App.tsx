import { useEffect, useState } from "react";
import {
  CORE_FAILED,
  CORE_RESTARTED,
  ensureCompatibleCore,
  onHostEvent,
  onNotification,
  request,
} from "../bridge/core";
import type {
  Place,
  Preferences,
  ProjectState,
  RecentProject,
  OwnAmbience,
  StartProblem,
  WorkFormat,
} from "../bridge/generated/protocol";
import { applyTheme } from "../design/themes";
import { Welcome, type Pickers } from "../features/welcome/Welcome";
import { BoardWindow } from "../features/workspace/BoardWindow";
import { isBoardWindow } from "../features/workspace/board-window";
import { WritingView } from "../features/editor/WritingView";
import { messageFor, messages } from "./messages";
import { LogFolderButton, Trouble } from "./Trouble";
import { savePendingNow } from "../editor/pending-saves";
import { DEFAULT_AMBIENCE } from "../features/ambience/defaults";

const HALTED =
  "Rocinante ha fallado varias veces seguidas y se ha detenido. Lo que aún no se haya guardado sigue en pantalla: cópialo antes de cerrar la app y volver a abrirla.";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "paper",
  outline: "docked",
  counterVisible: true,
  typewriterScrolling: true,
  mentionsVisible: true,
  correctionVisible: true,
  ambience: DEFAULT_AMBIENCE,
};

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
  const [suggestedFormat, setSuggestedFormat] = useState<WorkFormat | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [ownAmbience, setOwnAmbience] = useState<OwnAmbience[]>([]);
  // Set when the core stopped for good: said over the page, which is left as it is.
  const [halted, setHalted] = useState<string | null>(null);

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
        setSuggestedFormat(start.suggestedFormat);
        setOwnAmbience(start.ownAmbience);
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
      onNotification("project.closed", () => {
        setScreen({ kind: "welcome", notice: null });
        // The format to suggest may have changed while the work was open.
        void request("app.start", { origin })
          .then((start) => setSuggestedFormat(start.suggestedFormat))
          .catch(() => {});
      }),
      onNotification("recent.changed", ({ recent: next }) => setRecent(next)),
      onNotification("ambience.changed", ({ own }) => setOwnAmbience(own)),
      onNotification("preferences.changed", ({ preferences: next }) => applyPreferences(next)),
      // A new core took over after the old one fell: it reopens the project the writer had
      // open (the first window to ask does it) and the text not yet saved goes to it.
      onHostEvent(CORE_RESTARTED, () => {
        void request("app.start", { origin })
          .then(() => savePendingNow())
          .catch((error: unknown) => setHalted(messageFor(error)));
      }),
      // The page stays, so whatever could not be saved can still be copied.
      onHostEvent(CORE_FAILED, () => setHalted(HALTED)),
    ];

    return () => {
      for (const subscription of subscriptions) void subscription.then((stop) => stop());
    };
  }, [origin]);

  return (
    <>
      {halted && (
        <div className="halted" role="alert">
          <p>{halted}</p>
          <LogFolderButton />
        </div>
      )}
      {screenOf()}
    </>
  );

  function screenOf() {
    switch (screen.kind) {
      case "starting":
        // Something in the root says the interface is running (see public/boot-check.js).
        return <div className="app-starting" aria-busy="true" />;
      case "failed":
        return <Trouble message={screen.message} />;
      case "welcome":
        // The suggestion comes with the start, before the welcome screen can show.
        if (!suggestedFormat) return <div className="app-starting" aria-busy="true" />;
        return (
          <Welcome
            recent={recent}
            defaultFolder={defaultFolder}
            suggestedFormat={suggestedFormat}
            notice={screen.notice}
            origin={origin}
            pickers={pickers}
          />
        );
      case "writing":
        if (isBoardWindow(origin))
          return (
            <BoardWindow
              key={screen.project.path}
              project={screen.project}
              origin={origin}
              pickers={pickers}
            />
          );
        return (
          <WritingView
            key={screen.project.path}
            project={screen.project}
            place={screen.place}
            preferences={preferences ?? DEFAULT_PREFERENCES}
            ownAmbience={ownAmbience}
            pickers={pickers}
            origin={origin}
          />
        );
    }
  }
}

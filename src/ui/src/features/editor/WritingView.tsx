import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { request } from "../../bridge/core";
import type {
  DocumentState,
  Place,
  Preferences,
  ProjectState,
} from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { BookEditor } from "./BookEditor";
import "./writing-view.css";

interface WritingViewProps {
  project: ProjectState;
  place: Place | null;
  preferences: Preferences;
  origin: string;
}

/**
 * The open project: for now its first chapter, or the one where the writer left off. The index
 * (block 10) and the counter (block 11) will take over the choice of chapter and the bar.
 */
export function WritingView({ project, place, preferences, origin }: WritingViewProps) {
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [words, setWords] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The project and place only matter when the view opens; later changes arrive as notifications.
  const opening = useRef({ project, place, origin });

  useEffect(() => {
    const { project: opened, place: left, origin: self } = opening.current;

    async function documentToShow(): Promise<string> {
      if (left) return left.documentId;
      const chapter = opened.index.chapters[0];
      if (chapter) return chapter.id;
      const created = await request("document.create", {
        kind: "chapter",
        title: "Capítulo primero",
        origin: self,
      });
      return created.id;
    }

    documentToShow()
      .then((id) => request("document.get", { id }))
      .then((loaded) => {
        setDocument(loaded);
        setWords(loaded.statistics.words);
      })
      .catch((error: unknown) => setProblem(messageFor(error)));
  }, []);

  const update = (changes: Parameters<typeof request<"preferences.update">>[1]["changes"]) =>
    void request("preferences.update", { changes, origin });

  return (
    <div className="writing-view">
      <header className="writing-bar small-caps">
        <span>
          {project.title}
          {words !== null && <span className="writing-count"> · {words} palabras</span>}
        </span>
        <nav aria-label="Proyecto">
          <button
            className="action"
            onClick={() =>
              update({ theme: preferences.theme === "paper" ? "candlelight" : "paper" })
            }
          >
            {preferences.theme === "paper" ? "Luz de vela" : "Papel"}
          </button>
          <button
            className="action"
            aria-pressed={preferences.typewriterScrolling}
            onClick={() => update({ typewriterScrolling: !preferences.typewriterScrolling })}
          >
            Rodillo {preferences.typewriterScrolling ? "sí" : "no"}
          </button>
          <button className="action" onClick={() => void invoke("open_window")}>
            Otra ventana
          </button>
          <button className="action" onClick={() => void request("project.close", { origin })}>
            Cerrar proyecto
          </button>
        </nav>
      </header>
      {problem && (
        <p className="writing-problem" role="alert">
          {problem}
        </p>
      )}
      {document && (
        <BookEditor
          key={document.id}
          document={document}
          place={place}
          origin={origin}
          typewriterScrolling={preferences.typewriterScrolling}
          onWords={setWords}
          onProblem={setProblem}
        />
      )}
    </div>
  );
}

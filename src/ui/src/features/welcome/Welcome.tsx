import { useId, useState, type FormEvent } from "react";
import { request } from "../../bridge/core";
import type { RecentProject } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { Fleuron, Rule } from "../../design/Ornaments";
import { lastOpened } from "./dates";
import { folderOf, proposedPath } from "./paths";
import "./welcome.css";

/** The system dialogs the welcome screen needs. Injected so tests can answer for the writer. */
export interface Pickers {
  /** Asks for a folder; null if the writer cancels. */
  chooseFolder(startIn: string): Promise<string | null>;
  /** Asks for a project file; null if the writer cancels. */
  chooseProject(startIn: string): Promise<string | null>;
}

export interface WelcomeProps {
  recent: RecentProject[];
  /** Where new projects are proposed: Documentos/Rocinante. */
  defaultFolder: string;
  /** Something to tell the writer on arrival, such as why the last project did not open. */
  notice: string | null;
  /** Label of this window, sent as the origin of every change. */
  origin: string;
  pickers: Pickers;
}

/**
 * What the writer sees with no project open: recent projects, and the two ways in. When a
 * project opens, the core announces it to every window and the app leaves this screen.
 */
export function Welcome({ recent, defaultFolder, notice, origin, pickers }: WelcomeProps) {
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(notice);
  const [missing, setMissing] = useState<string | null>(null);

  async function attempt(action: () => Promise<unknown>) {
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(messageFor(error));
    }
  }

  const openPath = (path: string) => attempt(() => request("project.open", { path, origin }));

  async function openOther() {
    const path = await pickers.chooseProject(defaultFolder);
    if (path) await openPath(path);
  }

  async function forget(path: string) {
    setMissing(null);
    await attempt(() => request("recent.remove", { path, origin }));
  }

  if (creating) {
    return (
      <Page problem={problem}>
        <NewProject
          defaultFolder={defaultFolder}
          pickers={pickers}
          onCancel={() => {
            setProblem(null);
            setCreating(false);
          }}
          onCreate={(path, title) =>
            attempt(() => request("project.create", { path, title, origin }))
          }
        />
      </Page>
    );
  }

  return (
    <Page problem={problem}>
      {recent.length > 0 && (
        <section className="welcome-recent" aria-labelledby="welcome-recent-title">
          <h2 id="welcome-recent-title" className="welcome-label small-caps">
            Recientes
          </h2>
          <ul>
            {recent.map((project) => (
              <li key={project.path}>
                <button
                  className={`welcome-row${project.exists ? "" : " welcome-row-missing"}`}
                  title={project.path}
                  onClick={() =>
                    project.exists ? void openPath(project.path) : setMissing(project.path)
                  }
                >
                  <span className="welcome-row-title">{project.title}</span>
                  <span className="welcome-row-when">
                    {project.exists ? lastOpened(project.lastOpenedAt) : "no se encuentra"}
                  </span>
                </button>
                {missing === project.path && (
                  <p className="welcome-missing" role="status">
                    No se encuentra en {folderOf(project.path)}.{" "}
                    <button className="action" onClick={() => void forget(project.path)}>
                      Quitar de la lista
                    </button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="welcome-actions" aria-label="Empezar">
        <button className="action action-main" onClick={() => setCreating(true)}>
          Nuevo proyecto
        </button>
        <button className="action" onClick={() => void openOther()}>
          Abrir proyecto
        </button>
      </nav>
    </Page>
  );
}

function Page({ problem, children }: { problem: string | null; children: React.ReactNode }) {
  return (
    <main className="welcome">
      <header className="welcome-header">
        <h1 className="welcome-name small-caps">Rocinante</h1>
        <Fleuron className="welcome-fleuron" size={26} />
      </header>
      {problem && (
        <p className="welcome-problem" role="alert">
          {problem}
        </p>
      )}
      {children}
      <Rule className="welcome-rule" />
    </main>
  );
}

interface NewProjectProps {
  defaultFolder: string;
  pickers: Pickers;
  onCreate(path: string, title: string): Promise<void>;
  onCancel(): void;
}

function NewProject({ defaultFolder, pickers, onCreate, onCancel }: NewProjectProps) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState(defaultFolder);
  const [missingTitle, setMissingTitle] = useState(false);
  const titleId = useId();

  async function chooseFolder() {
    const chosen = await pickers.chooseFolder(folder);
    if (chosen) setFolder(chosen);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setMissingTitle(true);
      return;
    }
    await onCreate(proposedPath(folder, trimmed), trimmed);
  }

  return (
    <form className="welcome-new" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor={titleId} className="welcome-label small-caps">
        Título de la obra
      </label>
      <input
        id={titleId}
        className="welcome-title-input"
        value={title}
        maxLength={200}
        autoFocus
        aria-invalid={missingTitle}
        aria-describedby={missingTitle ? `${titleId}-error` : undefined}
        onChange={(event) => {
          setTitle(event.target.value);
          setMissingTitle(false);
        }}
      />
      {missingTitle && (
        <p id={`${titleId}-error`} className="welcome-problem" role="alert">
          Escribe un título.
        </p>
      )}
      <p className="welcome-where">
        Se guardará en <span className="welcome-path">{proposedPath(folder, title.trim())}</span>{" "}
        <button type="button" className="action" onClick={() => void chooseFolder()}>
          Elegir otra carpeta
        </button>
      </p>
      <div className="welcome-actions">
        <button type="submit" className="action action-main">
          Crear
        </button>
        <button type="button" className="action" onClick={onCancel}>
          Volver
        </button>
      </div>
    </form>
  );
}

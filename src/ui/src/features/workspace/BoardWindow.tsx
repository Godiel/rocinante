import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { lazy, Suspense, useCallback } from "react";
import type { ProjectState } from "../../bridge/generated/protocol";
import { savePendingNow } from "../../editor/pending-saves";
import { useBoard } from "../elements/useBoard";
import type { Pickers } from "../welcome/Welcome";
import { useBoardWindow } from "./board-window";

const BoardTab = lazy(() => import("../board/BoardTab"));

export interface BoardWindowProps {
  project: ProjectState;
  origin: string;
  pickers: Pickers;
}

/**
 * The board in a window of its own, to keep it on another screen while writing. «Acoplar», or closing the
 * window, takes it back to the window of the work.
 */
export function BoardWindow({ project, origin, pickers }: BoardWindowProps) {
  const { board, loaded } = useBoard(project.id);
  const close = useCallback(() => {
    void savePendingNow().then(() => getCurrentWebviewWindow().destroy());
  }, []);
  const { dock } = useBoardWindow(origin, close);

  return (
    <div className="board-window">
      <header className="writing-bar small-caps">
        <span className="writing-bar-start">
          <span className="writing-bar-title">{project.title}</span>
          <span className="board-window-name">Tablero</span>
        </span>
        <nav aria-label="Tablero">
          <button
            type="button"
            className="action"
            title="Devolver el Tablero a la ventana de la obra"
            onClick={dock}
          >
            Acoplar
          </button>
        </nav>
      </header>
      <Suspense fallback={null}>
        <BoardTab
          board={board}
          loaded={loaded}
          origin={origin}
          chooseImage={pickers.chooseElementImage}
        />
      </Suspense>
    </div>
  );
}

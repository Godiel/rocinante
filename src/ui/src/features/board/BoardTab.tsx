import type { Board } from "../../bridge/generated/protocol";
import "./board.css";

export interface BoardTabProps {
  board: Board;
  loaded: boolean;
}

/** The board of the work: the fichas as cards, and how they relate. Loaded the first time it opens. */
export default function BoardTab({ board, loaded }: BoardTabProps) {
  return (
    <div className="board-tab">
      {loaded && board.elements.length === 0 && (
        <p className="board-empty">
          Aún no hay fichas. Cuando las crees, aparecerán aquí como tarjetas.
        </p>
      )}
    </div>
  );
}

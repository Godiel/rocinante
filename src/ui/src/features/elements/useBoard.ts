import { useEffect, useState } from "react";
import { onNotification, request } from "../../bridge/core";
import type { Board, Element } from "../../bridge/generated/protocol";
import { applyChange, EMPTY_BOARD } from "./board-state";

/**
 * The elements of the open work, their relationships and the writer's kinds, kept current with what any
 * window does to them. `workId` names the work: a different one loads its own board.
 */
export function useBoard(workId: string): { board: Board; loaded: boolean } {
  const [state, setState] = useState<{ workId: string; board: Board; loaded: boolean }>({
    workId,
    board: EMPTY_BOARD,
    loaded: false,
  });

  useEffect(() => {
    let current = true;
    // Changes that arrive before the board itself are applied on top of it.
    const early: Parameters<typeof applyChange>[1][] = [];
    let loaded = false;
    const unlisten = onNotification("elements.changed", (change) => {
      if (!loaded) {
        early.push(change);
        return;
      }
      setState((previous) => ({ ...previous, board: applyChange(previous.board, change) }));
    });
    void request("board.get").then((board) => {
      if (!current) return;
      loaded = true;
      setState({ workId, board: early.reduce(applyChange, board), loaded: true });
    });
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [workId]);

  return state.workId === workId
    ? { board: state.board, loaded: state.loaded }
    : { board: EMPTY_BOARD, loaded: false };
}

/**
 * One element with everything in it, kept current: changes from any window arrive whole with the
 * notification. Null while it loads or if it is no longer there.
 */
export function useElement(id: string): Element | null {
  const [element, setElement] = useState<{ id: string; value: Element | null }>({
    id,
    value: null,
  });

  useEffect(() => {
    let current = true;
    const unlisten = onNotification("elements.changed", (change) => {
      const detail = change.details.find((candidate) => candidate.id === id);
      const summary = [...change.elements, ...change.trash].find(
        (candidate) => candidate.id === id,
      );
      if (detail) setElement({ id, value: detail });
      else if (summary)
        setElement((previous) =>
          previous.value ? { id, value: { ...previous.value, ...summary } } : previous,
        );
    });
    request("element.get", { id }).then(
      (value) => {
        if (current) setElement({ id, value });
      },
      () => {
        if (current) setElement({ id, value: null });
      },
    );
    return () => {
      current = false;
      void unlisten.then((stop) => stop());
    };
  }, [id]);

  return element.id === id ? element.value : null;
}

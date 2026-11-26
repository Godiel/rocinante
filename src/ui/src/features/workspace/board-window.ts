import { useCallback, useEffect, useState } from "react";

/** A window whose label starts like this shows only the board of the work. */
export function isBoardWindow(origin: string): boolean {
  return origin.startsWith("board-");
}

/**
 * What the windows of a work tell each other about the board: they share an origin, so a broadcast
 * channel reaches them all without the core.
 */
type BoardMessage =
  | { kind: "ask" }
  | { kind: "open"; label: string }
  | { kind: "closed"; label: string; show: boolean }
  | { kind: "dock" };

const CHANNEL = "rocinante-board";

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
}

/**
 * In the window of the work: whether the board is in a window of its own, and the way to bring it back.
 * `onDocked` is called when the board comes back asking to be shown.
 */
export function useDetachedBoard(onDocked: () => void): {
  detached: boolean;
  bringBack(): void;
} {
  const [detached, setDetached] = useState<string | null>(null);

  useEffect(() => {
    const board = channel();
    if (!board) return;
    board.onmessage = ({ data }: MessageEvent<BoardMessage>) => {
      if (data.kind === "open") setDetached(data.label);
      else if (data.kind === "closed") {
        setDetached((current) => (current === data.label ? null : current));
        if (data.show) onDocked();
      }
    };
    // A board window opened before this one says so when asked.
    board.postMessage({ kind: "ask" } satisfies BoardMessage);
    return () => board.close();
  }, [onDocked]);

  const bringBack = useCallback(() => {
    const board = channel();
    board?.postMessage({ kind: "dock" } satisfies BoardMessage);
    board?.close();
  }, []);

  return { detached: detached !== null, bringBack };
}

/**
 * In the window of the board: says it is open, answers when asked, and closes when the window of the work
 * takes the board back. `dock` closes it from here, asking the window of the work to show the board.
 */
export function useBoardWindow(label: string, close: () => void): { dock(): void } {
  useEffect(() => {
    const board = channel();
    if (!board) return;
    board.onmessage = ({ data }: MessageEvent<BoardMessage>) => {
      if (data.kind === "ask") board.postMessage({ kind: "open", label } satisfies BoardMessage);
      else if (data.kind === "dock") {
        board.postMessage({ kind: "closed", label, show: true } satisfies BoardMessage);
        close();
      }
    };
    board.postMessage({ kind: "open", label } satisfies BoardMessage);
    const gone = () =>
      board.postMessage({ kind: "closed", label, show: false } satisfies BoardMessage);
    window.addEventListener("pagehide", gone);
    return () => {
      window.removeEventListener("pagehide", gone);
      board.close();
    };
  }, [label, close]);

  const dock = useCallback(() => {
    const board = channel();
    board?.postMessage({ kind: "closed", label, show: true } satisfies BoardMessage);
    board?.close();
    close();
  }, [label, close]);

  return { dock };
}

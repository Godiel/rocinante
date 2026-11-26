import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { keepsItsOwnKeys } from "../../editor/own-keys";
import { isTabShortcut, isThreadsShortcut } from "./shortcuts";

export type WorkspaceTab = "writing" | "board" | "threads";

interface WorkspaceTabOptions {
  /** In focus mode there is only the text: F2 and F8 do nothing. */
  focused: boolean;
  /** Gives the keyboard back to the text on coming back to the writing. */
  onBackToWriting(): void;
}

/**
 * Which of the tabs of the work shows. The writing is hidden, never unmounted, while another shows:
 * coming back finds the text scrolled where it was, with the cursor where it was.
 */
export function useWorkspaceTab({ focused, onBackToWriting }: WorkspaceTabOptions) {
  const [tab, setTab] = useState<WorkspaceTab>("writing");
  // The board is loaded the first time it is asked for, and kept from then on.
  const [boardVisited, setBoardVisited] = useState(false);
  const [threadsVisited, setThreadsVisited] = useState(false);
  const scrolled = useRef(0);
  const latest = useRef({ focused, onBackToWriting });
  useEffect(() => {
    latest.current = { focused, onBackToWriting };
  });

  // What shows now, for the keys, which are bound once.
  const current = useRef(tab);

  const show = useCallback((next: WorkspaceTab) => {
    if (current.current === next) return;
    // The page itself scrolls; hiding the text would lose its place.
    if (current.current === "writing") scrolled.current = window.scrollY;
    current.current = next;
    if (next === "board") setBoardVisited(true);
    if (next === "threads") setThreadsVisited(true);
    setTab(next);
  }, []);

  const toggle = useCallback(
    () => show(current.current === "writing" ? "board" : "writing"),
    [show],
  );
  const toggleThreads = useCallback(
    () => show(current.current === "threads" ? "writing" : "threads"),
    [show],
  );

  // Back on the writing: where it was, and the keyboard in the text.
  const wasTab = useRef(tab);
  useLayoutEffect(() => {
    if (wasTab.current === tab) return;
    wasTab.current = tab;
    if (tab === "writing") {
      window.scrollTo(0, scrolled.current);
      latest.current.onBackToWriting();
    } else {
      window.scrollTo(0, 0);
    }
  }, [tab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const threads = isThreadsShortcut(event);
      if ((!threads && !isTabShortcut(event)) || keepsItsOwnKeys(event.target)) return;
      event.preventDefault();
      if (latest.current.focused) return;
      if (threads) toggleThreads();
      else toggle();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [toggle, toggleThreads]);

  return { tab, boardVisited, threadsVisited, show, toggle };
}

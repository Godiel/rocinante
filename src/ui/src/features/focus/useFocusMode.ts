import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusWindow } from "./focus-window";
import { isFocusShortcut, isLeaveFocusKey } from "./shortcuts";

interface FocusModeOptions {
  window: FocusWindow;
  /** Before the screen clears: the view puts away what it shows around the text. */
  onEnter(): void;
  /** After leaving: the view brings back what it put away. */
  onLeave(): void;
  /** Something went wrong with the window; the mode still works, only not full screen. */
  onProblem?(error: unknown): void;
}

/**
 * Focus mode: F11 goes in and out, Escape goes out. Escape is only taken once nothing smaller
 * on the page wanted it: a note being written or the page view handle their own, and a selection
 * in the text, which shows the format toolbar, is let go first. Leaving full screen some other way
 * (the system's own key or button) also leaves the mode.
 */
export function useFocusMode({ window: screen, onEnter, onLeave, onProblem }: FocusModeOptions) {
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  // While the window is on its way to full screen, its size changes are expected.
  const switching = useRef(false);
  const callbacks = useRef({ onEnter, onLeave, onProblem });
  useEffect(() => {
    callbacks.current = { onEnter, onLeave, onProblem };
  });

  const toScreen = useCallback(
    async (on: boolean) => {
      switching.current = true;
      try {
        await screen.setFullscreen(on);
      } catch (error) {
        callbacks.current.onProblem?.(error);
      } finally {
        switching.current = false;
      }
    },
    [screen],
  );

  const enter = useCallback(() => {
    if (focusedRef.current) return;
    focusedRef.current = true;
    callbacks.current.onEnter();
    setFocused(true);
    void toScreen(true);
  }, [toScreen]);

  const leave = useCallback(
    (fullscreenToo = true) => {
      if (!focusedRef.current) return;
      focusedRef.current = false;
      setFocused(false);
      callbacks.current.onLeave();
      if (fullscreenToo) void toScreen(false);
    },
    [toScreen],
  );

  // F11 first, before the editor or the browser see it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFocusShortcut(event)) return;
      event.preventDefault();
      if (focusedRef.current) leave();
      else enter();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [enter, leave]);

  // Escape last, once everything on the page had its chance to take it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!focusedRef.current || !isLeaveFocusKey(event)) return;
      // ProseMirror marks every Escape in the text as handled, though it does nothing with it;
      // anywhere else, a handled Escape belonged to something smaller (a note, the page view).
      if (event.defaultPrevented && !inText(event.target)) return;
      event.preventDefault();
      if (letGoOfSelection()) return;
      leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leave]);

  // Leaving full screen from the system leaves focus mode as well.
  useEffect(() => {
    if (!focused) return;
    let stop: (() => void) | null = null;
    let current = true;
    screen
      .onResized(() => {
        if (switching.current || !focusedRef.current) return;
        void screen.isFullscreen().then((full) => {
          if (!full && !switching.current) leave(false);
        });
      })
      .then((unlisten) => (current ? (stop = unlisten) : unlisten()))
      .catch((error: unknown) => callbacks.current.onProblem?.(error));
    return () => {
      current = false;
      stop?.();
    };
  }, [focused, screen, leave]);

  // Unmounting in focus mode (closing the project) gives the window back.
  useEffect(
    () => () => {
      if (focusedRef.current) void screen.setFullscreen(false).catch(() => {});
    },
    [screen],
  );

  return { focused, enter, leave: () => leave() };
}

function inText(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".book-page .ProseMirror") !== null;
}

/** Collapses a selection in the text to its end; true if there was one to let go. */
function letGoOfSelection(): boolean {
  const selection = document.getSelection();
  const text = document.querySelector(".book-page .ProseMirror");
  if (!selection || selection.isCollapsed || !text || !text.contains(selection.anchorNode)) {
    return false;
  }
  selection.collapseToEnd();
  return true;
}

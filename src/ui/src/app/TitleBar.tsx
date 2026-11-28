import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import "./titlebar.css";

const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/** The window of the app, or null outside Tauri (the tests of the interface). */
function currentWindow(): Window | null {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export interface TitleBarProps {
  /** The title of the work, or nothing on the welcome screen. */
  title: string | null;
}

/**
 * The bar of the window, Rocinante's own: the colour of the paper, a shade darker by day and lighter by
 * candlelight, with the title in small capitals. It moves the window, a double click maximises it, and on
 * Windows and Linux it has its own buttons; on macOS the system's traffic lights sit on it. It gives way in
 * full screen and in focus mode.
 */
export function TitleBar({ title }: TitleBarProps) {
  const [appWindow] = useState(currentWindow);
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!appWindow) return;
    let current = true;
    const look = () => {
      void Promise.all([appWindow.isFullscreen(), appWindow.isMaximized()]).then(
        ([full, max]) => {
          if (!current) return;
          setFullscreen(Boolean(full));
          setMaximized(Boolean(max));
        },
        () => {},
      );
    };
    look();
    const stop = appWindow.onResized(look);
    return () => {
      current = false;
      void stop.then((unlisten) => unlisten());
    };
  }, [appWindow]);

  // The page leaves room for the bar while it shows (tokens.css, --chrome).
  const shown = appWindow !== null && !fullscreen;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("has-titlebar", shown);
    return () => root.classList.remove("has-titlebar");
  }, [shown]);

  if (!shown) return null;

  const heading = title ? `${title} · Rocinante` : "Rocinante";
  return (
    <header className={`titlebar${MAC ? " titlebar-mac" : ""}`} data-tauri-drag-region>
      <span className="titlebar-title small-caps" data-tauri-drag-region>
        {heading}
      </span>
      {!MAC && (
        <span className="titlebar-buttons">
          <button
            type="button"
            className="titlebar-button"
            aria-label="Minimizar"
            title="Minimizar"
            onClick={() => void appWindow.minimize()}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 5.5h8" />
            </svg>
          </button>
          <button
            type="button"
            className="titlebar-button"
            aria-label={maximized ? "Restaurar" : "Maximizar"}
            title={maximized ? "Restaurar" : "Maximizar"}
            onClick={() => void appWindow.toggleMaximize()}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              {maximized ? (
                <path d="M2.5 3.5h5v5h-5zM3.5 3.5V1.5h5v5h-1" />
              ) : (
                <path d="M1.5 1.5h7v7h-7z" />
              )}
            </svg>
          </button>
          <button
            type="button"
            className="titlebar-button titlebar-close"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={() => void appWindow.close()}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
            </svg>
          </button>
        </span>
      )}
    </header>
  );
}

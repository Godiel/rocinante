import { getCurrentWindow } from "@tauri-apps/api/window";

/** What focus mode needs from the window. Injected so tests can stand in for it. */
export interface FocusWindow {
  setFullscreen(on: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  /** Calls back whenever the window changes size; resolves to a function that stops it. */
  onResized(changed: () => void): Promise<() => void>;
}

/** The app's own window, through the host. */
export function tauriWindow(): FocusWindow {
  const current = getCurrentWindow();
  return {
    setFullscreen: (on) => current.setFullscreen(on),
    isFullscreen: () => current.isFullscreen(),
    onResized: (changed) => current.onResized(changed),
  };
}

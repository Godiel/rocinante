import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./design/tokens.css";
import { App } from "./app/App";
import { reportProblem, reportUncaughtErrors } from "./app/diagnostics";
import { WindowGuard } from "./app/Trouble";
import { systemPickers } from "./app/pickers";

reportUncaughtErrors();
try {
  if (sessionStorage.getItem("rocinante-boot-retry")) {
    reportProblem("The interface did not start the first time and was loaded again", "warning");
  }
} catch {
  // Without session storage there is nothing to tell.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WindowGuard>
      <App origin={getCurrentWebviewWindow().label} pickers={systemPickers} />
    </WindowGuard>
  </StrictMode>,
);

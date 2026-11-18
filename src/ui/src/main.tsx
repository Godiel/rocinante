import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./design/tokens.css";
import { App } from "./app/App";
import { systemPickers } from "./app/pickers";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App origin={getCurrentWebviewWindow().label} pickers={systemPickers} />
  </StrictMode>,
);

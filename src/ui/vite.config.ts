/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri expects a fixed port and must not have its own output cleared by Vite.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  // A desktop app reads its code from the disk, not the network: one bundle of TipTap and
  // React is fine. The limit stays, so a much bigger bundle is still noticed.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});

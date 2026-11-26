/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { creditsText } from "./src/features/ambience/credits.ts";

/**
 * The SIL OFL asks for the licence to travel with the fonts. Every `@fontsource/*` dependency
 * gets its LICENSE copied into the build as `licenses/<font>.txt`, so the list of fonts is
 * package.json and nothing else.
 */
function fontLicences(): Plugin {
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const fonts = Object.keys(manifest.dependencies).filter((name) =>
    name.startsWith("@fontsource/"),
  );

  return {
    name: "rocinante-font-licences",
    apply: "build",
    generateBundle() {
      for (const font of fonts) {
        const folder = dirname(require.resolve(`${font}/latin-400.css`));
        this.emitFile({
          type: "asset",
          fileName: `licenses/${font.slice("@fontsource/".length)}.txt`,
          source: readFileSync(join(folder, "LICENSE"), "utf8"),
        });
      }
    },
  };
}

/** The credits of the sounds and pictures that come with the app, as licenses/ambience.txt. */
function ambienceCredits(): Plugin {
  return {
    name: "rocinante-ambience-credits",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "licenses/ambience.txt", source: creditsText() });
    },
  };
}

/**
 * The Spanish dictionary of LibreOffice (dictionary-es) is read by the spelling worker from its two files,
 * which the package does not export: an alias reaches its folder. Its licence travels with the app.
 */
const dictionaryFolder = dirname(createRequire(import.meta.url).resolve("dictionary-es"));

function dictionaryLicence(): Plugin {
  return {
    name: "rocinante-dictionary-licence",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "licenses/dictionary-es.txt",
        source: readFileSync(join(dictionaryFolder, "license"), "utf8"),
      });
    },
  };
}

// Tauri expects a fixed port and must not have its own output cleared by Vite.
export default defineConfig({
  plugins: [react(), fontLicences(), ambienceCredits(), dictionaryLicence()],
  resolve: { alias: { "@dictionary-es": dictionaryFolder } },
  worker: { format: "es" },
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

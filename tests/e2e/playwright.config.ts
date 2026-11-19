import { defineConfig } from "@playwright/test";

/**
 * The browser that drives the tests is the one already on the machine: Edge on Windows (the
 * same engine as WebView2) and Chrome elsewhere, so nothing is downloaded.
 */
const channel =
  process.env.ROCINANTE_E2E_CHANNEL ?? (process.platform === "win32" ? "msedge" : "chrome");

export default defineConfig({
  testDir: "specs",
  globalSetup: "./support/global-setup.ts",
  // Each test starts its own core; one at a time keeps the timings of the performance test honest.
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    channel,
    headless: true,
    trace: "retain-on-failure",
  },
});

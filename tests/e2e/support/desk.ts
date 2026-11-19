import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRelay, type Relay } from "./relay";

const SHIM = join(import.meta.dirname, "tauri-shim.js");

/** The app running: one window on a browser page, and the core behind it. */
export interface Running {
  page: Page;
  relay: Relay;
  context: BrowserContext;
}

/**
 * A writer's desk for one test: their own app data folder and a folder for their works, both
 * thrown away afterwards. The app can be opened, closed and broken on it as many times as needed.
 */
export class Desk {
  readonly root = mkdtempSync(join(tmpdir(), "rocinante-e2e-"));
  readonly data = join(this.root, "datos");
  readonly works = join(this.root, "obras");
  private readonly running = new Set<Running>();

  constructor(private readonly newContext: () => Promise<BrowserContext>) {
    mkdirSync(this.data);
    mkdirSync(this.works);
  }

  /** Starts the app, as double-clicking its icon does. */
  async open(): Promise<Running> {
    const relay = await startRelay(this.data);
    const context = await this.newContext();
    await context.addInitScript({ path: SHIM });
    const page = await context.newPage();
    await page.goto(relay.url);
    const running = { page, relay, context };
    this.running.add(running);
    return running;
  }

  /** Closes the window the normal way: what is pending is saved, then the app ends. */
  async close(app: Running): Promise<void> {
    await app.page.evaluate(() => window.__rocinanteE2E.requestClose());
    await app.relay.windowClosed;
    await app.context.close();
    await app.relay.stop();
    this.running.delete(app);
  }

  /** Ends everything at once with nothing saved on the way out, as a power cut would. */
  async crash(app: Running): Promise<void> {
    await Promise.all([app.relay.killCore(), app.context.close()]);
    await app.relay.stop();
    this.running.delete(app);
  }

  async clear(): Promise<void> {
    for (const app of this.running) {
      await app.context.close().catch(() => {});
      await app.relay.stop().catch(() => {});
    }
    rmSync(this.root, { recursive: true, force: true, maxRetries: 5 });
  }
}

/**
 * Creates a work from the welcome screen, in the desk's folder, with the suggested format, and
 * waits for its first chapter.
 */
export async function createWork(desk: Desk, page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByLabel("Título de la obra").fill(title);
  await page.evaluate((folder) => window.__rocinanteE2E.picks.push(folder), desk.works);
  await page.getByRole("button", { name: "Elegir otra carpeta" }).click();
  await expect(page.locator(".welcome-path")).toContainText(desk.works);
  await page.getByRole("button", { name: "Seguir" }).click();
  await page.getByRole("button", { name: "Omitir" }).click();
  await expect(chapterText(page)).toBeVisible();
}

export function chapterText(page: Page) {
  return page.getByRole("textbox", { name: "Texto del capítulo" });
}

export const test = base.extend<{ desk: Desk }>({
  desk: async ({ browser }, use) => {
    const desk = new Desk(() => browser.newContext({ viewport: { width: 1280, height: 860 } }));
    await use(desk);
    await desk.clear();
  },
});

export { expect };

declare global {
  interface Window {
    __rocinanteE2E: { picks: string[]; requestClose(): void };
  }
}

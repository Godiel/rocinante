import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { Ambience, OwnAmbience } from "../../../src/ui/src/bridge/generated/protocol";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

/** Counts every sound the page starts, with how long its recording is. */
async function listenToSounds(page: Page) {
  await page.evaluate(() => {
    const heard: number[] = [];
    (window as unknown as { heard: number[] }).heard = heard;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      heard.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
  });
}

const heard = (page: Page) =>
  page.evaluate(() => (window as unknown as { heard: number[] }).heard.splice(0));

/** Brings the minimal bar out, as the pointer at the top edge does. */
async function showFocusBar(page: Page) {
  await page.mouse.move(640, 300);
  await page.mouse.move(640, 2);
  await expect(page.getByRole("toolbar", { name: "Modo concentración" })).toHaveAttribute(
    "aria-hidden",
    "false",
  );
}

const ambienceOf = async (page: Page) =>
  (await call<{ preferences: { ambience: Ambience } }>(page, "app.start", { origin: "test" }))
    .preferences.ambience;

test("focus mode, with a background, typing and rain, is remembered from one session to the next", async ({
  desk,
}) => {
  const first = await desk.open();
  const { page } = first;
  await createWork(desk, page, "La Galatea");
  await chapterText(page).click();
  await listenToSounds(page);

  await page.keyboard.press("F11");
  await expect(page.locator(".writing-view")).toHaveClass(/writing-view-focus/);
  await expect(page.getByRole("button", { name: "Índice" })).toBeHidden();

  await showFocusBar(page);
  await page
    .getByRole("toolbar", { name: "Modo concentración" })
    .getByRole("button", { name: "Ambiente" })
    .click();
  const sheet = page.getByRole("complementary", { name: "Ambiente" });
  await sheet.getByRole("radio", { name: "Una vela" }).click();
  await sheet.getByRole("checkbox", { name: "Lluvia" }).check();
  await sheet
    .getByRole("region", { name: "Tecleo" })
    .getByRole("checkbox", { name: "Silencio" })
    .uncheck();
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  // The candle burns behind the sheet, and the rain falls.
  await expect(page.locator("canvas.focus-backdrop-animated")).toBeVisible();
  await expect.poll(async () => (await heard(page)).some((seconds) => seconds > 10)).toBe(true);

  // Every keystroke that writes is heard; the arrows are not.
  await chapterText(page).click();
  await page.keyboard.press("End");
  await heard(page);
  await page.keyboard.type("Elicio");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await heard(page)).length).toBe(6);

  await page.keyboard.press("Escape");
  await expect(page.locator(".writing-view")).not.toHaveClass(/writing-view-focus/);
  await expect(page.getByRole("button", { name: "Índice" })).toBeVisible();

  await desk.close(first);
  const again = await desk.open();
  await expect(chapterText(again.page)).toContainText("Elicio");
  const ambience = await ambienceOf(again.page);
  expect(ambience.background).toBe("builtin:candle");
  expect(ambience.ambients).toEqual([{ id: "builtin:rain", level: 0.7 }]);
  expect(ambience.typing.muted).toBe(false);
});

// A 1 × 1 PNG: enough for the core to know it is an image and for the page to show it.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

test("a background of the writer's own is a copy, and stays when the original is gone", async ({
  desk,
}) => {
  const original = join(desk.root, "molinos.png");
  writeFileSync(original, PNG);
  const first = await desk.open();
  const { page } = first;
  await createWork(desk, page, "Persiles y Sigismunda");

  await page.getByRole("button", { name: "Ambiente" }).click();
  await page.evaluate((path) => window.__rocinanteE2E.picks.push(path), original);
  await page.getByRole("button", { name: "Añadir una imagen tuya" }).click();
  await expect(page.getByRole("radio", { name: "molinos.png" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  rmSync(original);
  await desk.close(first);

  const again = await desk.open();
  const own = (
    await call<{ ownAmbience: OwnAmbience[] }>(again.page, "app.start", { origin: "test" })
  ).ownAmbience;
  expect(own).toEqual([expect.objectContaining({ kind: "image", name: "molinos.png" })]);

  await chapterText(again.page).click();
  await again.page.keyboard.press("F11");
  const backdrop = again.page.locator("div.focus-backdrop");
  await expect(backdrop).toHaveCSS("background-image", /\/ambience\/[0-9a-f-]+\.png/);
  const status = await again.page.evaluate(async () => {
    const image = getComputedStyle(document.querySelector("div.focus-backdrop")!).backgroundImage;
    return (await fetch(image.slice(5, -2))).status;
  });
  expect(status).toBe(200);
});

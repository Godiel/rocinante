import type { Page } from "@playwright/test";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

function card(page: Page, name: string) {
  return page.locator(`.react-flow__node[aria-label^="${name},"]`);
}

test("the board tells what the text says of each ficha", async ({ desk }) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  for (const name of ["Don Quijote", "Sancho", "Rocinante"]) {
    await call(page, "element.create", { kind: "character", name, origin: "seed" });
  }
  await chapterText(page).click();
  await page.keyboard.type("Don Quijote y Sancho salieron. Sancho llevaba el asno.");

  // Each card says how many times its ficha is mentioned, and in how many chapters.
  await page.keyboard.press("F2");
  await expect(card(page, "Sancho")).toContainText("2 menciones · 1 capítulo");
  await expect(card(page, "Don Quijote")).toContainText("1 mención · 1 capítulo");
  await expect(card(page, "Rocinante")).toContainText("Sin menciones");
});

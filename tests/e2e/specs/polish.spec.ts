import type { Page } from "@playwright/test";
import { chapterText, createWork, expect, test } from "../support/desk";

/** The boxes of the visible actions of the bar of the work, read at once, as they are now. */
function barBoxes(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        ".bar-actions > button, .bar-actions > .bar-more > button",
      ),
    ].map((button) => {
      const box = button.getBoundingClientRect();
      return { name: button.innerText.trim(), x: box.x, width: box.width };
    }),
  );
}

test("in a narrow window nothing overlaps, and what does not fit is in «Más»", async ({ desk }) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await page.setViewportSize({ width: 1024, height: 640 });

  await expect(page.getByRole("button", { name: "Más" })).toBeVisible();
  // Once the bar has settled at its new width.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const boxes = await barBoxes(page);
  for (let index = 1; index < boxes.length; index++) {
    const before = boxes[index - 1]!;
    expect(boxes[index]!.x, `${boxes[index]!.name} after ${before.name}`).toBeGreaterThanOrEqual(
      before.x + before.width,
    );
  }
  const tabs = await page.getByRole("tablist", { name: "Vistas de la obra" }).boundingBox();
  expect(boxes[0]!.x).toBeGreaterThan(tabs!.x + tabs!.width);
  for (const always of ["Fichas", "Escudero", "Exportar"]) {
    await expect(page.getByRole("button", { name: always, exact: true })).toBeVisible();
  }

  // What went to the menu is there, and works from it.
  await page.getByRole("button", { name: "Más" }).click();
  const menu = page.getByRole("menu", { name: "Más" });
  await expect(menu.getByRole("menuitem", { name: "Cerrar proyecto" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Teclas rápidas" }).click();
  await expect(page.getByRole("dialog", { name: "Teclas rápidas" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Teclas rápidas" })).toHaveCount(0);

  // Wide again, the bar takes back what fits.
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.getByRole("button", { name: "Formato", exact: true })).toBeVisible();
  await desk.close(app);
});

test("F1 shows the shortcuts, and a new chapter without a name is somewhere to write", async ({
  desk,
}) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await chapterText(page).click();
  await page.keyboard.type("Primer capítulo.");

  await page.keyboard.press("F1");
  const shortcuts = page.getByRole("dialog", { name: "Teclas rápidas" });
  await expect(shortcuts.getByRole("region", { name: "Vistas" })).toContainText("Exportar la obra");
  await page.keyboard.press("F1");
  await expect(shortcuts).toHaveCount(0);

  // A new chapter, its name left as it is: the page invites to write, and a click anywhere on it does.
  await page.getByRole("button", { name: "Capítulo nuevo" }).click();
  await page.keyboard.press("Tab");
  await expect(chapterText(page)).toBeVisible();
  await expect(chapterText(page).locator("p[data-placeholder='Empieza a escribir…']")).toHaveCount(
    1,
  );
  const main = await page.locator(".writing-main").boundingBox();
  // Low on the visible paper and to the right, far from the first line.
  const height = page.viewportSize()!.height;
  await page.mouse.click(main!.x + main!.width - 40, Math.min(main!.y + main!.height, height) - 60);
  await page.keyboard.type("Segundo capítulo.");
  await expect(chapterText(page)).toHaveText("Segundo capítulo.");
  await desk.close(app);
});

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

  // Choosing a card leaves clear those that share paragraphs with it.
  await card(page, "Sancho").click();
  await expect(card(page, "Don Quijote")).not.toHaveClass(/board-faded/);
  await expect(card(page, "Rocinante")).toHaveClass(/board-faded/);

  // The ficha says with whom, in how many paragraphs.
  await page.keyboard.press("F2");
  await page.keyboard.press("Control+Shift+E");
  const panel = page.getByRole("complementary", { name: "Fichas de la obra" });
  await panel.getByRole("button", { name: /^Sancho/ }).click();
  const inText = panel.getByRole("region", { name: "En el texto" });
  await expect(inText).toContainText("Coincide con");
  await expect(inText).toContainText("Don Quijote en 1 párrafo");
  await inText.getByRole("button", { name: "Don Quijote", exact: true }).click();
  await expect(panel.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue(
    "Don Quijote",
  );
});

test("the text suggests fichas for the names it repeats", async ({ desk }) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "El Toboso");
  await chapterText(page).click();
  await page.keyboard.type(
    "Pensaba en Dulcinea y en Maritornes. Soñaba con Dulcinea y con Maritornes. Escribía a Dulcinea y a Maritornes.",
  );
  await page.keyboard.press("Control+Shift+E");
  const panel = page.getByRole("complementary", { name: "Fichas de la obra" });
  await panel.getByText("Sugerencias (2)").click();

  // One becomes a ficha, the other is dismissed for good.
  await panel.getByRole("button", { name: "Crear la ficha de «Dulcinea»" }).click();
  await expect(panel.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Dulcinea");
  await panel.getByRole("button", { name: "← Fichas" }).click();
  await panel.getByText("Sugerencias (1)").click();
  await panel.getByRole("button", { name: "Descartar «Maritornes»" }).click();
  await expect(panel.getByText(/Sugerencias/)).toHaveCount(0);
  await desk.close(app);

  const again = await desk.open();
  await expect(chapterText(again.page)).toBeVisible();
  expect(await call(again.page, "suggestions.get")).toEqual([]);
});

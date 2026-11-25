import type { Locator, Page } from "@playwright/test";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

interface BoardShape {
  elements: { id: string; name: string; kind: string; position: { x: number; y: number } }[];
  relationships: { from: string; to: string; kind: string }[];
  trash: { name: string }[];
}

function card(page: Page, name: string): Locator {
  return page.locator(`.react-flow__node[aria-label^="${name},"]`);
}

/** Makes a ficha from the board, names it and closes it again. */
async function newCard(page: Page, name: string, kind?: string) {
  await page.getByRole("button", { name: "Nueva ficha" }).click();
  const field = page.getByRole("textbox", { name: "Nombre", exact: true });
  await expect(field).toBeFocused();
  await field.fill(name);
  if (kind) await page.getByRole("combobox", { name: "Tipo" }).selectOption({ label: kind });
  await expect(card(page, name)).toBeVisible();
  await page
    .getByRole("complementary", { name: "Ficha" })
    .getByRole("button", { name: "Cerrar" })
    .click();
}

/** Drags from the handle of one card and lets go on the other, as a hand joins them. */
async function join(page: Page, from: string, to: string) {
  const source = card(page, from);
  await source.hover();
  const handle = source.locator(".board-card-handle");
  const start = (await handle.boundingBox())!;
  const end = (await card(page, to).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(
      start.x + ((end.x + end.width / 2 - start.x) * step) / 10,
      start.y + ((end.y + end.height / 2 - start.y) * step) / 10,
    );
  }
  await page.mouse.up();
}

test("the elements of a work: made, related, trashed and kept as they were", async ({ desk }) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La Mancha");
  await chapterText(page).click();
  await page.keyboard.type("Dulcinea del Toboso esperaba sin saberlo.");

  // A character and a place on the board, joined by an arrow.
  await page.keyboard.press("F2");
  await expect(page.getByRole("tab", { name: "Tablero" })).toHaveAttribute("aria-selected", "true");
  await newCard(page, "Alonso Quijano");
  await newCard(page, "La Mancha", "Lugar");
  await join(page, "Alonso Quijano", "La Mancha");
  const picker = page.getByRole("dialog", { name: "Alonso Quijano es… La Mancha" });
  await picker.getByRole("button", { name: "vive en", exact: true }).click();
  await expect(
    page.locator('.react-flow__edge[aria-label="Alonso Quijano vive en La Mancha"]'),
  ).toBeVisible();

  // A ficha from the text, which stays as it was.
  await page.keyboard.press("F2");
  // A double click on the first word selects it.
  await chapterText(page)
    .locator("p")
    .first()
    .dblclick({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: "Crear ficha con este nombre" }).click();
  const panel = page.getByRole("complementary", { name: "Fichas de la obra" });
  await expect(panel.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue("Dulcinea");
  await expect(panel.getByRole("combobox", { name: "Tipo" })).toBeFocused();
  await expect(chapterText(page)).toHaveText("Dulcinea del Toboso esperaba sin saberlo.");

  // To the trash and back.
  await panel.getByRole("button", { name: "Mandar a la papelera" }).click();
  await expect(page.getByText("«Dulcinea» está en la papelera.")).toBeVisible();
  await panel.getByText("Papelera (1)").click();
  await panel.getByRole("button", { name: "Restaurar «Dulcinea»" }).click();
  await expect(panel.getByRole("button", { name: /^Dulcinea/ })).toBeVisible();
  await expect(panel.getByText(/Papelera/)).toHaveCount(0);

  const before = await call<BoardShape>(page, "board.get");
  expect(before.elements.map((element) => element.name).sort()).toEqual([
    "Alonso Quijano",
    "Dulcinea",
    "La Mancha",
  ]);
  await desk.close(app);

  // Opened again, everything is where it was left.
  const again = await desk.open();
  await expect(chapterText(again.page)).toBeVisible();
  const after = await call<BoardShape>(again.page, "board.get");
  expect(after).toEqual(before);
  await again.page.keyboard.press("F2");
  await expect(card(again.page, "Dulcinea")).toBeVisible();
  await expect(card(again.page, "La Mancha")).toHaveAttribute("aria-label", "La Mancha, Lugar");
  await expect(
    again.page.locator('.react-flow__edge[aria-label="Alonso Quijano vive en La Mancha"]'),
  ).toBeVisible();
});

test("another window of the work sees the fichas change as they change", async ({ desk }) => {
  const app = await desk.open();
  await createWork(desk, app.page, "Dos ventanas");
  const other = await desk.openWindow(app, "otra");
  await expect(chapterText(other)).toBeVisible();
  await other.keyboard.press("Control+Shift+E");
  const panel = other.getByRole("complementary", { name: "Fichas de la obra" });
  await expect(panel.getByText(/Aún no hay fichas/)).toBeVisible();

  // Made on the board of one window…
  await app.page.keyboard.press("F2");
  await newCard(app.page, "Sancho Panza");
  // …it shows in the list of the other, and so does a new name.
  await expect(panel.getByRole("button", { name: /^Sancho Panza/ })).toBeVisible();
  await card(app.page, "Sancho Panza").dblclick();
  await app.page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Sancho");
  await expect(panel.getByRole("button", { name: /^Sancho$/ })).toBeVisible();

  // And what the other window trashes leaves the board of the first.
  await panel.getByRole("button", { name: /^Sancho$/ }).click();
  await panel.getByRole("button", { name: "Mandar a la papelera" }).click();
  await expect(card(app.page, "Sancho")).toHaveCount(0);
});

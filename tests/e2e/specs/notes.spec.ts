import type { Page } from "@playwright/test";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

interface StoredNote {
  id: string;
  documentId: string | null;
  text: string;
  anchored: boolean;
  resolvedAt: string | null;
  elements: string[];
}

function notesPanel(page: Page) {
  return page.getByRole("complementary", { name: "Notas de la obra" });
}

function listed(page: Page) {
  return notesPanel(page).getByRole("list", { name: "Notas" }).getByRole("button");
}

/** Links the open note with a ficha found by its name, as the writer does. */
async function link(page: Page, name: string) {
  const panel = notesPanel(page);
  await panel.getByRole("button", { name: "Enlazar con una ficha…" }).click();
  await panel.getByRole("searchbox", { name: "Buscar una ficha para enlazar" }).fill(name);
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("button", { name, exact: true })).toBeVisible();
}

test("the notes of a work: written, linked, found, resolved and kept as they were", async ({
  desk,
}) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await chapterText(page).click();
  await page.keyboard.type("Antonio llegó a la venta al anochecer.");
  const antonio = await call<{ id: string }>(page, "element.create", {
    kind: "character",
    name: "Antonio",
    origin: "seed",
  });

  // A note on a word of the text, with some cursive.
  await chapterText(page)
    .locator("p")
    .first()
    .dblclick({ position: { x: 12, y: 12 } });
  await page.keyboard.press("Control+Alt+N");
  const slip = page.getByRole("textbox", { name: "Texto de la nota" });
  await expect(slip).toBeFocused();
  await page.keyboard.type("Aquí aún no conoce a ");
  await page.keyboard.press("Control+I");
  await page.keyboard.type("Claudio");
  await page.keyboard.press("Control+Enter");
  await expect(chapterText(page).locator("[data-note-id]")).toHaveText("Antonio");

  // A loose idea from the panel, linked with Antonio.
  await page.keyboard.press("Control+Shift+N");
  const panel = notesPanel(page);
  await panel.getByRole("button", { name: "Nueva idea" }).click();
  await expect(panel.getByRole("textbox", { name: "Texto de la nota" })).toBeFocused();
  await page.keyboard.type("Que Antonio no vuelva nunca a la venta");
  await link(page, "Antonio");
  await panel.getByRole("button", { name: "← Notas" }).click();

  // The note of the text, linked with Antonio too.
  await listed(page).filter({ hasText: "Aquí aún no conoce a Claudio" }).click();
  await link(page, "Antonio");
  await panel.getByRole("button", { name: "← Notas" }).click();
  await expect(listed(page)).toHaveCount(2);

  // Found with the filters, which add up.
  const kind = panel.getByRole("combobox", { name: "Clase de nota" });
  await kind.selectOption({ label: "Ideas sueltas" });
  await expect(listed(page)).toHaveText([/^Que Antonio no vuelva/]);
  await kind.selectOption({ label: "Con fichas" });
  await expect(listed(page)).toHaveCount(2);
  await panel.getByRole("searchbox", { name: "Buscar en las notas" }).fill("CLAUDIO");
  await expect(listed(page)).toHaveText([/^Aquí aún no conoce a Claudio/]);

  // To the passage, with the panel still open.
  await listed(page).first().click();
  await chapterText(page).click();
  await page.keyboard.press("Control+End");
  await panel.getByRole("button", { name: "Ir al pasaje" }).click();
  await expect.poll(() => page.evaluate(() => getSelection()?.toString().trim())).toBe("Antonio");
  await expect(panel).toBeVisible();

  // The idea is resolved, and leaves the list unless the resolved are asked for.
  await panel.getByRole("button", { name: "← Notas" }).click();
  await panel.getByRole("searchbox", { name: "Buscar en las notas" }).fill("");
  await kind.selectOption({ label: "Todas las notas" });
  await listed(page).filter({ hasText: "Que Antonio no vuelva" }).click();
  await panel.getByRole("checkbox", { name: "Resuelta" }).check();
  await panel.getByRole("button", { name: "← Notas" }).click();
  await expect(listed(page)).toHaveText([/^Aquí aún no conoce/]);
  await panel.getByRole("checkbox", { name: "Ver resueltas" }).check();
  await expect(listed(page)).toHaveCount(2);

  const before = await call<StoredNote[]>(page, "notes.get");
  expect(before).toHaveLength(2);
  expect(before.every((note) => note.elements.join() === antonio.id)).toBe(true);
  expect(before.find((note) => note.documentId === null)?.resolvedAt).not.toBeNull();
  await desk.close(app);

  // Opened again, everything is where it was left.
  const again = await desk.open();
  await expect(chapterText(again.page)).toBeVisible();
  expect(await call<StoredNote[]>(again.page, "notes.get")).toEqual(before);
  await again.page.keyboard.press("Control+Shift+N");
  await expect(listed(again.page)).toHaveText([/^Aquí aún no conoce a Claudio/]);
  await expect(chapterText(again.page).locator("[data-note-id]")).toHaveText("Antonio");
});

test("another window of the work sees the notes change as they change", async ({ desk }) => {
  const app = await desk.open();
  await createWork(desk, app.page, "Dos ventanas");
  const other = await desk.openWindow(app, "otra");
  await expect(chapterText(other)).toBeVisible();
  await chapterText(other).click();
  await other.keyboard.press("Control+Shift+N");
  await expect(notesPanel(other).getByText(/Aún no hay notas/)).toBeVisible();

  // Written in one window…
  await chapterText(app.page).click();
  await app.page.keyboard.press("Control+Shift+N");
  await notesPanel(app.page).getByRole("button", { name: "Nueva idea" }).click();
  await expect(
    notesPanel(app.page).getByRole("textbox", { name: "Texto de la nota" }),
  ).toBeFocused();
  await app.page.keyboard.type("Un final en el Toboso");
  // …it shows in the other.
  await expect(listed(other)).toHaveText([/^Un final en el Toboso/]);

  // What the other resolves leaves the first.
  await listed(other).first().click();
  await notesPanel(other).getByRole("checkbox", { name: "Resuelta" }).check();
  await notesPanel(app.page).getByRole("button", { name: "← Notas" }).click();
  await expect(notesPanel(app.page).getByText("Ninguna nota coincide.")).toBeVisible();
});

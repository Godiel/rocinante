import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

test("the spelling and the punctuation are marked, and only what the writer chooses changes", async ({
  desk,
}) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await call(page, "element.create", { kind: "character", name: "Maritornes", origin: "seed" });
  await chapterText(page).click();
  await page.keyboard.type("La cassa de Maritornes era grande. Llegó Clavileño volando.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("¿Vienes conmigo.");

  // A word the dictionary does not know is marked; the name of a ficha is not.
  const misspelled = chapterText(page).locator(".misspelled");
  await expect(misspelled).toHaveText(["cassa", "Clavileño"], { timeout: 15_000 });
  await expect(chapterText(page).locator(".punctuation-issue")).toHaveCount(1);

  // A suggestion takes its place; nothing else changed.
  await misspelled.first().click();
  const slip = page.getByRole("dialog", { name: "Ortografía de «cassa»" });
  await slip.getByRole("button", { name: "casa", exact: true }).click();
  await expect(chapterText(page).locator("p").first()).toHaveText(
    "La casa de Maritornes era grande. Llegó Clavileño volando.",
  );

  // A word of the writer's goes to their own dictionary and stops being marked, in every work.
  await misspelled.first().click();
  await page
    .getByRole("dialog", { name: "Ortografía de «Clavileño»" })
    .getByRole("button", { name: "Añadir al diccionario" })
    .click();
  await expect(misspelled).toHaveCount(0);
  expect(await call(page, "dictionary.get")).toEqual(["Clavileño"]);

  // The opening sign without its close is explained, and left as it is if the writer wants.
  await chapterText(page).locator(".punctuation-issue").click();
  const punctuation = page.getByRole("dialog", { name: "Puntuación" });
  await expect(punctuation).toContainText("Este «¿» no se cierra con «?».");
  await punctuation.getByRole("button", { name: "Dejarlo así" }).click();
  await expect(chapterText(page).locator("p").nth(1)).toHaveText("¿Vienes conmigo.");

  // F7 hides the marks and shows them again.
  await page.keyboard.press("F7");
  await expect(chapterText(page).locator(".punctuation-issue")).toHaveCount(0);
  await page.keyboard.press("F7");
  await expect(chapterText(page).locator(".punctuation-issue")).toHaveCount(1);
});

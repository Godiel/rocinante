import { chapterText, expect, test } from "../support/desk";

test("a format chosen when creating a work is kept, and shows in the text and in the pages", async ({
  desk,
}) => {
  const first = await desk.open();
  const { page } = first;
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByLabel("Título de la obra").fill("Novelas ejemplares");
  await page.evaluate((folder) => window.__rocinanteE2E.picks.push(folder), desk.works);
  await page.getByRole("button", { name: "Elegir otra carpeta" }).click();
  await page.getByRole("button", { name: "Seguir" }).click();

  await page.getByLabel("Tamaño").selectOption("pocket");
  await page.getByLabel("Tipografía").selectOption("literata");
  await page.getByLabel("Capitular al empezar cada capítulo").check();
  await page.getByRole("button", { name: "Crear con este formato" }).click();

  await chapterText(page).click();
  await page.keyboard.type("Preciosa era una gitanilla de quince años.");
  await desk.close(first);

  const again = await desk.open();
  const text = chapterText(again.page);
  await expect(text).toContainText("Preciosa era una gitanilla");

  // The continuous paper is set in the typeface of the work, with its drop cap.
  const paragraph = text.locator("p").first();
  expect(await paragraph.evaluate((p) => getComputedStyle(p).fontFamily)).toContain("Literata");
  // The drop cap is in rubric red, unlike the rest of the paragraph.
  expect(await paragraph.evaluate((p) => getComputedStyle(p, "::first-letter").color)).not.toBe(
    await paragraph.evaluate((p) => getComputedStyle(p).color),
  );

  // The format sheet says the same.
  await again.page.getByRole("button", { name: "Formato" }).click();
  await expect(again.page.getByLabel("Tamaño")).toHaveValue("pocket");
  await expect(again.page.getByLabel("Tipografía")).toHaveValue("literata");
  await again.page
    .getByRole("complementary", { name: "Formato de «Novelas ejemplares»" })
    .getByRole("button", { name: "Cerrar" })
    .click();

  // The page view draws pocket pages, 11 × 17 cm, with the text in Literata.
  await again.page.keyboard.press("F5");
  const sheet = again.page.getByRole("img", { name: "Página 1" });
  await expect(sheet).toContainText("Preciosa era una gitanilla");
  const box = (await sheet.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(110 / 170, 2);
  expect(
    await sheet
      .locator("p")
      .first()
      .evaluate((p) => getComputedStyle(p).fontFamily),
  ).toContain("Literata");

  await again.page.keyboard.press("Escape");
  await expect(again.page.getByRole("region", { name: "Vista de página" })).toHaveCount(0);
});

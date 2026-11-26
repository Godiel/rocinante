import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

test("the names of the fichas are marked in the text as it is written", async ({ desk }) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await call(page, "element.create", {
    kind: "character",
    name: "Alonso Quijano",
    attributes: [{ name: "Edad", value: "cincuenta años" }],
    origin: "seed",
  });
  const sancho = await call<{ id: string }>(page, "element.create", {
    kind: "character",
    name: "Sancho",
    origin: "seed",
  });
  await call(page, "element.update", {
    id: sancho.id,
    changes: { aliases: ["el escudero"] },
    origin: "seed",
  });

  await chapterText(page).click();
  await page.keyboard.type("Alonso Quijano y el escudero llegaron. Sanch");
  const marks = chapterText(page).locator(".mention");
  await expect(marks).toHaveText(["Alonso Quijano", "el escudero"]);
  await page.keyboard.type("o bebió.");
  await expect(marks).toHaveText(["Alonso Quijano", "el escudero", "Sancho"]);
  await expect(chapterText(page)).toHaveText(
    "Alonso Quijano y el escudero llegaron. Sancho bebió.",
  );

  // The hand over a name shows the ficha in small, and from there it opens whole.
  await marks.first().hover();
  const card = page.getByRole("dialog", { name: "Ficha de Alonso Quijano" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Personaje");
  await expect(card).toContainText("cincuenta años");
  await card.getByRole("button", { name: "Abrir la ficha" }).click();
  const panel = page.getByRole("complementary", { name: "Fichas de la obra" });
  await expect(panel.getByRole("textbox", { name: "Nombre", exact: true })).toHaveValue(
    "Alonso Quijano",
  );
  await expect(card).toBeHidden();

  // «En el texto»: how many, where first, and each one takes the text to it.
  const inText = panel.getByRole("region", { name: "En el texto" });
  await expect(inText).toContainText("1 mención en 1 capítulo.");
  await chapterText(page).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Alonso Quijano volvió.");
  await expect(inText).toContainText("2 menciones en 1 capítulo.");
  await inText.getByRole("button", { name: /volvió/ }).click();
  await expect.poll(() => page.evaluate(() => getSelection()?.toString())).toBe("Alonso Quijano");

  // The marks can be hidden, and come back.
  await panel.getByRole("button", { name: "← Fichas" }).click();
  const toggle = panel.getByRole("checkbox", { name: "Marcar menciones en el texto" });
  await toggle.uncheck();
  await expect(marks).toHaveCount(0);
  await toggle.check();
  await expect(marks).toHaveCount(4);
});

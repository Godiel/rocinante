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
});

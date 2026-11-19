import { chapterText, createWork, expect, test } from "../support/desk";

test("a work created, written in and closed opens again as it was left", async ({ desk }) => {
  const first = await desk.open();
  await createWork(desk, first.page, "El ingenioso hidalgo");
  await chapterText(first.page).click();
  await first.page.keyboard.type("En un lugar de la Mancha, de cuyo nombre no quiero acordarme.");
  await first.page.keyboard.press("Enter");
  await first.page.keyboard.type("No ha mucho tiempo que vivía un hidalgo.");

  // Closed straight after typing: saving on the way out is what keeps the last words.
  await desk.close(first);

  const again = await desk.open();
  const text = chapterText(again.page);
  await expect(text).toBeVisible();
  await expect(text.locator("p")).toHaveText([
    "En un lugar de la Mancha, de cuyo nombre no quiero acordarme.",
    "No ha mucho tiempo que vivía un hidalgo.",
  ]);
  await expect(again.page.getByText("El ingenioso hidalgo").first()).toBeVisible();
});

import { expect, test } from "../support/desk";

const FAMILIES = [
  "EB Garamond",
  "Literata",
  "Crimson Pro",
  "Source Serif 4",
  "Libre Baskerville",
  "Courier Prime",
];

test("the six typefaces of the work come with the app and load without internet", async ({
  desk,
}) => {
  const app = await desk.open();
  const outside: string[] = [];
  await app.context.route(
    (url) => url.hostname !== "127.0.0.1",
    (route) => {
      outside.push(route.request().url());
      return route.abort();
    },
  );
  await expect(app.page.getByRole("button", { name: "Nuevo proyecto" })).toBeVisible();

  const loaded = await app.page.evaluate(async (families) => {
    const styles = ["", "italic ", "bold ", "italic bold "];
    const result: Record<string, number> = {};
    for (const family of families) {
      let faces = 0;
      for (const style of styles) {
        // Accented capitals and «» need Latin and Latin Extended.
        faces += (await document.fonts.load(`${style}16px "${family}"`, "ÁÉÑ «Ññ» ŒŸ")).length;
      }
      result[family] = faces;
    }
    return result;
  }, FAMILIES);

  for (const family of FAMILIES) {
    expect(loaded[family], family).toBeGreaterThanOrEqual(4);
  }
  expect(outside).toEqual([]);
});

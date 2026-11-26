import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

const FORMATS = [
  { label: /^PDF/, extension: "pdf", start: "%PDF" },
  { label: /^EPUB/, extension: "epub", start: "PK" },
  { label: /^Word/, extension: "docx", start: "PK" },
  { label: /^Markdown/, extension: "md", start: "# La venta" },
];

test("the work goes out as a book in the four formats, with its author and without its fragments", async ({
  desk,
}) => {
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "La venta");
  await chapterText(page).click();
  await page.keyboard.type("Antonio llegó a la venta al caer la tarde.");
  await call(page, "document.create", { kind: "fragment", title: "Suelto", origin: "seed" });

  for (const [index, format] of FORMATS.entries()) {
    await page.keyboard.press("F9");
    const dialog = page.getByRole("dialog", { name: "Exportar la obra" });
    await expect(dialog).toBeVisible();
    if (index === 0) {
      // The author is kept in the work for the next time.
      await dialog.getByLabel("Autor").fill("Miguel de Cervantes");
    } else {
      await expect(dialog.getByLabel("Autor")).toHaveValue("Miguel de Cervantes");
    }
    await dialog.getByRole("radio", { name: format.label }).check();
    const path = join(desk.works, `La venta.${format.extension}`);
    await page.evaluate((chosen) => window.__rocinanteE2E.picks.push(chosen), path);
    await dialog.getByRole("button", { name: "Exportar…" }).click();
    await expect(
      dialog.getByText(`Listo: el libro está en «La venta.${format.extension}»`),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Mostrar en la carpeta" })).toBeVisible();
    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog).toHaveCount(0);

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).subarray(0, format.start.length).toString("latin1")).toBe(
      format.start,
    );
  }

  const markdown = readFileSync(join(desk.works, "La venta.md"), "utf8");
  expect(markdown).toContain("Miguel de Cervantes");
  expect(markdown).toContain("Antonio llegó a la venta al caer la tarde.");
  expect(markdown).not.toContain("Suelto");
  expect((await call<{ author: string }>(page, "book.get")).author).toBe("Miguel de Cervantes");

  await desk.close(app);
});

test("a long work is exported in the background, in time", async ({ desk }) => {
  test.setTimeout(240_000);
  const app = await desk.open();
  const { page } = app;
  await createWork(desk, page, "Obra larga");
  const { fillWork, CHAPTER_WORDS, WORK_WORDS } = await import("../support/book");
  await fillWork(page, CHAPTER_WORDS, WORK_WORDS);

  const limits: Record<string, number> = { pdf: 30_000, epub: 10_000, docx: 10_000, md: 10_000 };
  for (const [format, limit] of Object.entries(limits)) {
    const path = join(desk.works, `Obra larga.${format}`);
    const started = Date.now();
    await call(page, "export.run", {
      format,
      parts: { cover: true, credits: true, contents: true },
      path,
      origin: "seed",
    });
    // Meanwhile the core answers other requests: the export does not hold it.
    await call(page, "project.get");
    const answered = Date.now() - started;
    await expect.poll(() => existsSync(path), { timeout: limit + 5_000 }).toBe(true);
    const took = Date.now() - started;
    process.stdout.write(
      `      exportar ${WORK_WORDS} palabras a ${format}: ${took} ms · ${statSync(path).size} bytes · el núcleo respondió en ${answered} ms\n`,
    );
    expect(took).toBeLessThan(limit);
    expect(answered).toBeLessThan(2_000);
  }

  await desk.close(app);
});

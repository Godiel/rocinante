import type { Page } from "@playwright/test";
import { chapterText, createWork, expect, test } from "../support/desk";

/** "No delay when typing": 95 % of keystrokes are on screen within this time. */
const NO_DELAY_P95_MS = 50;
/**
 * GitHub's macOS machines are virtual and have no graphics card, so every frame is painted in
 * software. There the test cannot measure what a writer feels; it only guards against the editor
 * becoming several times slower.
 */
const VIRTUAL_MAC_P95_MS = 150;
const MAX_P95_MS =
  process.env.CI && process.platform === "darwin" ? VIRTUAL_MAC_P95_MS : NO_DELAY_P95_MS;
const CHAPTER_WORDS = 20_000;
const WORK_WORDS = 150_000;
const WORDS_PER_PARAGRAPH = 100;

const VOCABULARY = (
  "en un lugar de la mancha cuyo nombre no quiero acordarme ha mucho tiempo que vivía " +
  "hidalgo los lanza astillero adarga antigua rocín flaco galgo corredor olla algo más vaca " +
  "carnero salpicón noches duelos quebrantos sábados lentejas viernes palomino añadidura " +
  "domingos consumían tres partes hacienda resto della concluían sayo velarte calzas"
).split(" ");

/** Fills the open work through the core: the first chapter, then others up to `total` words. */
async function fillWork(page: Page, chapterWords: number, workWords: number) {
  await page.evaluate(
    async ({ first, total, perParagraph, vocabulary }) => {
      const call = async (method: string, params: unknown) => {
        const reply = await (
          await fetch("/rpc", { method: "POST", body: JSON.stringify({ method, params }) })
        ).json();
        if ("error" in reply) throw new Error(JSON.stringify(reply.error));
        return reply.result;
      };
      const content = (words: number, seed: number) => ({
        type: "doc",
        content: Array.from({ length: Math.ceil(words / perParagraph) }, (_, p) => ({
          type: "paragraph",
          content: [
            {
              type: "text",
              text:
                Array.from(
                  { length: Math.min(perParagraph, words - p * perParagraph) },
                  (_word, i) => vocabulary[(p * perParagraph + i * 7 + seed) % vocabulary.length],
                ).join(" ") + ".",
            },
          ],
        })),
      });
      const project = await call("project.get", null);
      const opened = project.index.chapters[0].id;
      await call("document.save", { id: opened, content: content(first, 0), origin: "seed" });
      let left = total - first;
      for (let n = 2; left > 0; n++) {
        const words = Math.min(first, left);
        const entry = await call("document.create", {
          kind: "chapter",
          title: `Capítulo ${n}`,
          origin: "seed",
        });
        await call("document.save", { id: entry.id, content: content(words, n), origin: "seed" });
        left -= words;
      }
    },
    {
      first: chapterWords,
      total: workWords,
      perParagraph: WORDS_PER_PARAGRAPH,
      vocabulary: VOCABULARY,
    },
  );
}

/**
 * Types `text` and measures each keystroke from the moment it happened to the frame after the
 * editor took it in, which is when the letter is on screen.
 */
async function typeAndMeasure(page: Page, text: string): Promise<number[]> {
  await page.evaluate(() => {
    const times: number[] = [];
    (window as unknown as { keystrokes: number[] }).keystrokes = times;
    document.addEventListener(
      "keydown",
      (event) => {
        const at = event.timeStamp;
        requestAnimationFrame(() => setTimeout(() => times.push(performance.now() - at)));
      },
      { capture: true },
    );
  });
  await page.keyboard.type(text, { delay: 40 });
  await page.waitForTimeout(200);
  return page.evaluate(() => (window as unknown as { keystrokes: number[] }).keystrokes);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

/** Puts the cursor in the middle of the chapter, where a writer revising would be. */
async function cursorInTheMiddle(page: Page) {
  const middle = chapterText(page)
    .locator("p")
    .nth(CHAPTER_WORDS / WORDS_PER_PARAGRAPH / 2);
  await middle.scrollIntoViewIfNeeded();
  await middle.click();
  await page.keyboard.press("End");
}

test.describe("typing in a long work", () => {
  test.setTimeout(180_000);

  test(`a chapter of ${CHAPTER_WORDS} words in a work of ${WORK_WORDS} keeps up with typing`, async ({
    desk,
  }) => {
    const app = await desk.open();
    await createWork(desk, app.page, "Obra larga");
    await fillWork(app.page, CHAPTER_WORDS, WORK_WORDS);
    await app.page.reload();
    await expect(chapterText(app.page).locator("p")).toHaveCount(
      CHAPTER_WORDS / WORDS_PER_PARAGRAPH,
    );
    await expect(app.page.getByText(/obra 150\.000/)).toBeVisible();

    await cursorInTheMiddle(app.page);
    const sentence = " Y así, del poco dormir y del mucho leer, se le secó el celebro.";
    const times = await typeAndMeasure(app.page, sentence.repeat(3));

    const p95 = percentile(times, 95);
    const summary = `${times.length} pulsaciones · mediana ${percentile(times, 50).toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · máx ${Math.max(...times).toFixed(1)} ms`;
    test.info().annotations.push({ type: "keystrokes", description: summary });
    process.stdout.write(`      ${summary}\n`);
    // Letters with accents are typed without a key event (as an IME would), so they are not timed.
    expect(times.length).toBe([...sentence.repeat(3)].filter((c) => c.charCodeAt(0) < 128).length);
    expect(p95).toBeLessThan(MAX_P95_MS);

    // And what was typed is kept.
    await desk.close(app);
    const again = await desk.open();
    await expect(chapterText(again.page)).toContainText("se le secó el celebro.");
  });
});

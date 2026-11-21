import type { Page } from "@playwright/test";
import type { Ambience, WorkFormat } from "../../../src/ui/src/bridge/generated/protocol";
import {
  call,
  CHAPTER_WORDS,
  changeFormat,
  fillWork,
  WORDS_PER_PARAGRAPH,
  WORK_WORDS,
} from "../support/book";
import { chapterText, createWork, expect, test, type Desk, type Running } from "../support/desk";

/**
 * GitHub's macOS machines are virtual and have no graphics card, so every frame is painted in
 * software. There these tests cannot measure what a writer feels; they only guard against the
 * app becoming several times slower.
 */
const VIRTUAL_MAC = Boolean(process.env.CI) && process.platform === "darwin";

/** "No delay when typing": 95 % of keystrokes are on screen within this time. */
const MAX_P95_MS = VIRTUAL_MAC ? 150 : 50;
/** The page view of a work of 150 000 words opens within this time. */
const MAX_PAGE_VIEW_MS = VIRTUAL_MAC ? 6000 : 2000;
/**
 * The CI machines have no graphics card, so an animated background is painted in software there,
 * which a writer's computer never does. There focus mode is measured over a plain background.
 */
const ANIMATED = !process.env.CI;

/** A keystroke's sound is set going within this time of the key, so it is heard with the key. */
const MAX_SOUND_DELAY_MS = VIRTUAL_MAC ? 60 : 20;

/** Formats that set the text very differently, to type with each. */
const FORMATS: [string, Partial<WorkFormat>][] = [
  ["EB Garamond justificada (por defecto)", {}],
  [
    "Courier Prime a la izquierda, sin sangría, con capitular",
    { typeface: "courierPrime", justified: false, firstLineIndent: false, dropCap: true },
  ],
  [
    "Literata de 12 pt justificada, con capitular",
    { typeface: "literata", bodySize: 12, leading: 1.5, dropCap: true },
  ],
];

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
  return page.evaluate(() => (window as unknown as { keystrokes: number[] }).keystrokes.splice(0));
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

function report(line: string) {
  test.info().annotations.push({ type: "performance", description: line });
  process.stdout.write(`      ${line}\n`);
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

/** A work of 150 000 words, open on its first chapter of 20 000. */
async function longWork(desk: Desk): Promise<Running> {
  const app = await desk.open();
  await createWork(desk, app.page, "Obra larga");
  await fillWork(app.page, CHAPTER_WORDS, WORK_WORDS);
  await app.page.reload();
  await expect(chapterText(app.page).locator("p")).toHaveCount(CHAPTER_WORDS / WORDS_PER_PARAGRAPH);
  await expect(app.page.getByText(/obra 150\.000/)).toBeVisible();
  return app;
}

test.describe("a long work", () => {
  test.setTimeout(240_000);

  test(`a chapter of ${CHAPTER_WORDS} words in a work of ${WORK_WORDS} keeps up with typing, whatever its format`, async ({
    desk,
  }) => {
    const app = await longWork(desk);
    const sentence = " Y así, del poco dormir y del mucho leer, se le secó el celebro.";
    // Letters with accents are typed without a key event (as an IME would), so they are not timed.
    const timed = [...sentence.repeat(2)].filter((c) => c.charCodeAt(0) < 128).length;

    for (const [name, changes] of FORMATS) {
      await changeFormat(app.page, changes);
      await cursorInTheMiddle(app.page);
      const times = await typeAndMeasure(app.page, sentence.repeat(2));

      const p95 = percentile(times, 95);
      report(
        `${name}: ${times.length} pulsaciones · mediana ${percentile(times, 50).toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · máx ${Math.max(...times).toFixed(1)} ms`,
      );
      expect(times.length, name).toBe(timed);
      expect(p95, name).toBeLessThan(MAX_P95_MS);
    }

    // And what was typed is kept.
    await desk.close(app);
    const again = await desk.open();
    await expect(chapterText(again.page)).toContainText("se le secó el celebro.");
  });

  test(`in focus mode, with the typewriter heard${ANIMATED ? " and the rain falling on the window" : ""}, typing keeps up`, async ({
    desk,
  }) => {
    const app = await longWork(desk);
    const { preferences } = await call<{ preferences: { ambience: Ambience } }>(
      app.page,
      "app.start",
      { origin: "test" },
    );
    await call(app.page, "preferences.update", {
      changes: {
        ambience: {
          ...preferences.ambience,
          background: ANIMATED ? "builtin:rain-window" : "builtin:parchment",
          typing: { sound: "typewriter", volume: 0.6, muted: false },
        },
      },
      origin: "test",
    });
    await cursorInTheMiddle(app.page);
    await app.page.keyboard.press("F11");
    if (ANIMATED) await expect(app.page.locator("canvas.focus-backdrop-animated")).toBeVisible();

    // From each key to the moment its sound is set going.
    await app.page.evaluate(() => {
      const delays: number[] = [];
      (window as unknown as { delays: number[] }).delays = delays;
      let key = 0;
      document.addEventListener("keydown", (event) => (key = event.timeStamp), { capture: true });
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        delays.push(performance.now() - key);
        return start.apply(this, args);
      };
    });
    // The first keystrokes wake the sound and load the recordings; they are not measured.
    await app.page.keyboard.type(" En", { delay: 80 });
    await app.page.waitForTimeout(500);
    await app.page.evaluate(() => (window as unknown as { delays: number[] }).delays.splice(0));

    const sentence = " Y así, del poco dormir y del mucho leer, se le secó el celebro.";
    const times = await typeAndMeasure(app.page, sentence.repeat(2));
    const delays = await app.page.evaluate(() =>
      (window as unknown as { delays: number[] }).delays.splice(0),
    );

    const p95 = percentile(times, 95);
    const soundP95 = percentile(delays, 95);
    report(
      `concentración con tecleo${ANIMATED ? " y lluvia animada" : " (fondo liso)"}: ${times.length} pulsaciones · p95 ${p95.toFixed(1)} ms · sonido p95 ${soundP95.toFixed(1)} ms · máx ${Math.max(...delays).toFixed(1)} ms`,
    );
    expect(p95).toBeLessThan(MAX_P95_MS);
    expect(delays.length).toBeGreaterThan(times.length * 0.9);
    expect(soundP95).toBeLessThan(MAX_SOUND_DELAY_MS);
  });

  test(`the page view of a work of ${WORK_WORDS} words opens in under ${MAX_PAGE_VIEW_MS / 1000} s`, async ({
    desk,
  }) => {
    const app = await longWork(desk);
    await cursorInTheMiddle(app.page);
    // Where the cursor was when F5 was pressed, to tell a click that missed from a view that
    // opened in the wrong place.
    const cursorWas = await app.page.evaluate(() => {
      const text = document.querySelector(".book-page .ProseMirror");
      const anchor = document.getSelection()?.anchorNode ?? null;
      const paragraph =
        anchor instanceof Element ? anchor.closest("p") : anchor?.parentElement?.closest("p");
      const index = paragraph && text ? [...text.querySelectorAll("p")].indexOf(paragraph) : -1;
      return `cursor in paragraph ${index}, text focused: ${document.activeElement === text}`;
    });

    const started = Date.now();
    await app.page.keyboard.press("F5");
    const count = app.page.getByText(/^\d+ páginas$/);
    await expect(count).toBeVisible({ timeout: 30_000 });
    const elapsed = Date.now() - started;

    const pages = Number((await count.textContent())!.split(" ")[0]);
    report(`vista de página: ${pages} páginas en ${elapsed} ms`);
    expect(elapsed).toBeLessThan(MAX_PAGE_VIEW_MS);
    // An A5 page holds a few hundred words: the book has hundreds of pages, not a handful.
    expect(pages).toBeGreaterThan(300);

    // It opened on the page of the cursor, in the middle of the first chapter, not on the first page.
    // The view may still be settling its scroll when the count appears: wait for it, briefly.
    const inSight = () =>
      app.page.getByRole("img", { name: /^Página \d+$/ }).evaluateAll((sheets) =>
        sheets
          .filter((sheet) => {
            const box = sheet.getBoundingClientRect();
            return box.bottom > 0 && box.top < window.innerHeight;
          })
          .map((sheet) => Number(sheet.getAttribute("aria-label")!.split(" ")[1])),
      );
    await expect
      .poll(
        async () => {
          const shown = await inSight();
          return shown.length > 0 && Math.min(...shown) > 10 && Math.max(...shown) < 80
            ? "on the page of the cursor"
            : `pages in sight: ${shown.join(", ")} (${cursorWas})`;
        },
        { timeout: 5000 },
      )
      .toBe("on the page of the cursor");
  });
});

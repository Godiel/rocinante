import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { chapterText, createWork, expect, test } from "../support/desk";

/** The spec allows losing what was typed in the last two seconds before a crash, no more. */
const ALLOWED_LOSS_MS = 2000;
const TYPING_MS = 6000;

test("a crash while typing loses at most the last two seconds and leaves the file whole", async ({
  desk,
}) => {
  const first = await desk.open();
  await createWork(desk, first.page, "Batalla de los molinos");
  await chapterText(first.page).click();

  // Steady typing with no pause long enough for the usual wait before saving.
  const typed: { word: string; at: number }[] = [];
  const started = Date.now();
  for (let n = 1; Date.now() - started < TYPING_MS; n++) {
    const word = `molino${n}`;
    await first.page.keyboard.type(`${word} `, { delay: 25 });
    typed.push({ word, at: Date.now() });
  }
  const crashedAt = Date.now();
  await desk.crash(first);

  const [file] = readdirSync(desk.works).filter((name) => name.endsWith(".rocinante"));
  expect(file).toBeDefined();
  const database = new DatabaseSync(join(desk.works, file!));
  try {
    expect(database.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  } finally {
    database.close();
  }

  const again = await desk.open();
  await expect(chapterText(again.page)).toBeVisible();
  const kept = (await chapterText(again.page).innerText()).trim().split(/\s+/);
  const mustKeep = typed.filter(({ at }) => at <= crashedAt - ALLOWED_LOSS_MS).map((t) => t.word);

  expect(mustKeep.length).toBeGreaterThan(10);
  expect(kept.slice(0, mustKeep.length)).toEqual(mustKeep);
  // What was kept is what was typed, in order; the last word may have been cut mid-way.
  const whole = kept.slice(0, -1);
  expect(whole).toEqual(typed.slice(0, whole.length).map((t) => t.word));
  expect(typed[whole.length]?.word.startsWith(kept.at(-1)!)).toBe(true);
});

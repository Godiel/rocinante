import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILT_IN_AMBIENTS } from "../../audio/ambient-sounds";
import { TYPING_SOUNDS } from "../../audio/typing-sounds";
import { BUILT_IN_BACKDROPS } from "./catalog";
import { CREDITS, creditsText } from "./credits";

const PUBLIC = resolve(import.meta.dirname, "..", "..", "..", "public");
/** What the sounds and pictures that come with the app may weigh in all, as agreed. */
const BUDGET_BYTES = 15 * 1024 * 1024;

function filesUnder(folder: string): string[] {
  const full = join(PUBLIC, folder);
  if (!existsSync(full)) return [];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(PUBLIC, join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

const shipped = [...filesUnder("sounds"), ...filesUnder("backgrounds")];
const credited = CREDITS.flatMap((credit) => credit.files);
/** A URL of the catalog, as a path under public/. */
const inPublic = (url: string) => url.replace(/^\//, "");

describe("the sounds and pictures that come with the app", () => {
  it("are every one of them credited, once", () => {
    expect([...credited].sort()).toEqual([...shipped].sort());
    expect(new Set(credited).size).toBe(credited.length);
  });

  it("are all free of rights, with the page they came from", () => {
    for (const credit of CREDITS) {
      expect(["CC0-1.0", "Public domain", "Synthesised by Rocinante (MIT)"]).toContain(
        credit.licence,
      );
      expect(credit.source).toMatch(/^https:\/\//);
      expect(credit.author).not.toBe("");
    }
  });

  it("are there for everything the catalogs offer", () => {
    const offered = [
      ...Object.values(TYPING_SOUNDS).flatMap((sound) => [
        ...sound.keys,
        sound.enter,
        sound.backspace,
        ...(sound.bell ? [sound.bell] : []),
      ]),
      ...BUILT_IN_AMBIENTS.map((sound) => sound.url),
      ...BUILT_IN_BACKDROPS.flatMap((backdrop) =>
        backdrop.kind === "image" ? [backdrop.url] : [],
      ),
    ].map(inPublic);

    for (const file of offered) expect(shipped).toContain(file);
  });

  it("weigh no more than agreed", () => {
    const bytes = shipped.reduce((sum, file) => sum + statSync(join(PUBLIC, file)).size, 0);
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
  });

  it("travel with the app with their credits", () => {
    const text = creditsText();
    for (const credit of CREDITS) {
      expect(text).toContain(credit.author);
      expect(text).toContain(credit.source);
    }
  });
});

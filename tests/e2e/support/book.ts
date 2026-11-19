import type { Page } from "@playwright/test";
import type { WorkFormat } from "../../../src/ui/src/bridge/generated/protocol";

/** Calls the core from the page, through the test relay, as the interface does. */
export async function call<T = unknown>(
  page: Page,
  method: string,
  params: unknown = null,
): Promise<T> {
  return page.evaluate(
    async (message) => {
      const reply = await (
        await fetch("/rpc", { method: "POST", body: JSON.stringify(message) })
      ).json();
      if ("error" in reply) throw new Error(JSON.stringify(reply.error));
      return reply.result;
    },
    { method, params },
  ) as Promise<T>;
}

/** Changes some settings of the format of the open work, as the format sheet would. */
export async function changeFormat(page: Page, changes: Partial<WorkFormat>): Promise<WorkFormat> {
  const project = await call<{ format: WorkFormat }>(page, "project.get");
  const format = { ...project.format, ...changes };
  await call(page, "project.setFormat", { format, origin: "test" });
  return format;
}

export const CHAPTER_WORDS = 20_000;
export const WORK_WORDS = 150_000;
export const WORDS_PER_PARAGRAPH = 100;

const VOCABULARY = (
  "en un lugar de la mancha cuyo nombre no quiero acordarme ha mucho tiempo que vivía " +
  "hidalgo los lanza astillero adarga antigua rocín flaco galgo corredor olla algo más vaca " +
  "carnero salpicón noches duelos quebrantos sábados lentejas viernes palomino añadidura " +
  "domingos consumían tres partes hacienda resto della concluían sayo velarte calzas"
).split(" ");

/** Fills the open work through the core: the first chapter, then others up to `total` words. */
export async function fillWork(page: Page, chapterWords: number, workWords: number) {
  await page.evaluate(
    async ({ first, total, perParagraph, vocabulary }) => {
      const ask = async (method: string, params: unknown) => {
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
      const project = await ask("project.get", null);
      const opened = project.index.chapters[0].id;
      await ask("document.save", { id: opened, content: content(first, 0), origin: "seed" });
      let left = total - first;
      for (let n = 2; left > 0; n++) {
        const words = Math.min(first, left);
        const entry = await ask("document.create", {
          kind: "chapter",
          title: `Capítulo ${n}`,
          origin: "seed",
        });
        await ask("document.save", { id: entry.id, content: content(words, n), origin: "seed" });
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

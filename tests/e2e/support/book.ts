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

/**
 * Fills the board of the open work through the core: `cards` fichas in a grid and `arrows` relationships
 * between them, each pair joined once.
 */
export async function fillBoard(page: Page, cards: number, arrows: number) {
  await page.evaluate(
    async ({ count, joins }) => {
      const ask = async (method: string, params: unknown) => {
        const reply = await (
          await fetch("/rpc", { method: "POST", body: JSON.stringify({ method, params }) })
        ).json();
        if ("error" in reply) throw new Error(JSON.stringify(reply.error));
        return reply.result;
      };
      const kinds = ["character", "place", "plot"] as const;
      const ids: string[] = [];
      const columns = Math.ceil(Math.sqrt(count * 2));
      for (let n = 0; n < count; n++) {
        const created = await ask("element.create", {
          kind: kinds[n % kinds.length],
          name: `Ficha ${n + 1}`,
          position: { x: (n % columns) * 260, y: Math.floor(n / columns) * 120 },
          origin: "seed",
        });
        ids.push(created.id);
      }
      // Each card joined to the next one and to one further on: no pair twice.
      const steps = [1, 17, 41];
      for (let made = 0; made < joins; made++) {
        const from = made % count;
        const step = steps[Math.floor(made / count)]!;
        await ask("relationship.create", {
          from: ids[from],
          to: ids[(from + step) % count],
          kind: made % 2 === 0 ? "builtin:friend-of" : "builtin:child-of",
          origin: "seed",
        });
      }
    },
    { count: cards, joins: arrows },
  );
}

/**
 * Fills the work with notes, as a writer who has been at it for months: half are loose ideas, half belong
 * to its chapters, loose in them; one in five is resolved.
 */
export async function fillNotes(page: Page, count: number) {
  await page.evaluate(async (total) => {
    const ask = async (method: string, params: unknown) => {
      const reply = await (
        await fetch("/rpc", { method: "POST", body: JSON.stringify({ method, params }) })
      ).json();
      if ("error" in reply) throw new Error(JSON.stringify(reply.error));
      return reply.result;
    };
    const project = await ask("project.get", null);
    const chapters: string[] = project.index.chapters.map((entry: { id: string }) => entry.id);
    for (let n = 0; n < total; n++) {
      const note = await ask("note.create", {
        documentId: n % 2 === 0 ? null : chapters[n % chapters.length],
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Nota ${n + 1}: revisar lo que pasa en la venta.` }],
            },
          ],
        },
        anchored: false,
        origin: "seed",
      });
      if (n % 5 === 0) {
        await ask("note.update", { id: note.id, changes: { resolved: true }, origin: "seed" });
      }
    }
  }, count);
}

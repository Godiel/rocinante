import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

const KEY = "clave-de-prueba";
const ARRIVAL = "Antonio llegó con su hijo Claudio a la venta.";
const DEATH = "Aquella noche murió el padre de Antonio, sin decir palabra.";
const JOURNEY = "Antonio salió de la venta camino de Madrid al amanecer.";

/** A provider compatible with OpenAI on this computer that sees a milestone in every paragraph. */
async function fakeProvider(): Promise<{ server: Server; address: string }> {
  const server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      if (request.headers.authorization !== `Bearer ${KEY}`) {
        response.writeHead(401).end();
        return;
      }
      const answer = JSON.stringify({
        elements: [],
        relationships: [],
        attributes: [],
        milestones: [{ element: "Antonio", text: "Parte hacia Madrid" }],
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ choices: [{ message: { role: "assistant", content: answer } }] }),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return { server, address: `http://127.0.0.1:${port}/v1` };
}

const paragraphs = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

test("the threads of fate: where each ficha goes, what happens to it and when its relationships hold", async ({
  desk,
}) => {
  const provider = await fakeProvider();
  try {
    const app = await desk.open();
    const { page } = app;
    await createWork(desk, page, "La venta");
    const antonio = await call<{ id: string }>(page, "element.create", {
      kind: "character",
      name: "Antonio",
      origin: "seed",
    });
    const claudio = await call<{ id: string }>(page, "element.create", {
      kind: "character",
      name: "Claudio",
      origin: "seed",
    });
    const project = await call<{ index: { chapters: { id: string; title: string }[] } }>(
      page,
      "project.get",
    );
    const first = project.index.chapters[0]!;
    const second = await call<{ id: string }>(page, "document.create", {
      kind: "chapter",
      title: "El camino",
      origin: "seed",
    });
    await call(page, "document.save", {
      id: second.id,
      content: paragraphs("Claudio se quedó solo en el camino."),
      origin: "seed",
    });
    await call(page, "relationship.create", {
      from: claudio.id,
      to: antonio.id,
      kind: "builtin:child-of",
      origin: "seed",
    });

    // Written in the first chapter, the two meet in a paragraph.
    await chapterText(page).click();
    await page.keyboard.type(ARRIVAL);
    await page.keyboard.press("Enter");
    await page.keyboard.type(DEATH);

    // F8: the two threads through the two chapters, joined where they meet.
    await page.keyboard.press("F8");
    const threads = page.getByRole("tabpanel", { name: "Hilos" });
    await expect(
      threads.getByRole("button", { name: /^Antonio en «.*»: 2 menciones$/ }),
    ).toBeVisible();
    await expect(
      threads.getByRole("button", { name: "Claudio en «El camino»: 1 mención" }),
    ).toBeVisible();
    await expect(threads.getByRole("button", { name: /^Antonio en «El camino»/ })).toHaveCount(0);
    await expect(threads.locator(".threads-meeting")).toHaveCount(1);

    // A milestone marked from the text, at the paragraph of the selection.
    await page.keyboard.press("F8");
    await chapterText(page).locator("p").nth(1).click({ clickCount: 3 });
    await page.getByRole("button", { name: "Marcar un hito en este párrafo" }).click();
    const slip = page.getByRole("dialog", { name: "Marcar hito" });
    await expect(slip.getByLabel("Ficha")).toHaveValue(antonio.id);
    await slip.getByLabel("¿Qué le ocurre?").fill("Muere su padre");
    await slip.getByRole("button", { name: "Marcar" }).click();
    await expect(slip).toHaveCount(0);
    await page.keyboard.press("F8");
    await expect(
      threads.getByRole("button", { name: "Hito de Antonio: Muere su padre" }),
    ).toBeVisible();

    // The relationship holds only in the first chapter, set in the ficha.
    await page.keyboard.press("F8");
    await page.keyboard.press("Control+Shift+E");
    const panel = page.getByRole("complementary", { name: "Fichas de la obra" });
    await panel
      .getByRole("button", { name: /^Antonio/ })
      .first()
      .click();
    await panel.getByRole("button", { name: "Cuándo vale «padre de Claudio»" }).click();
    await panel.getByLabel("hasta").selectOption({ label: `1. ${first.title || "Sin título"}` });
    await expect(panel.getByText(/hasta el capítulo 1/)).toBeVisible();
    const board = await call<{ relationships: { starts: string | null; ends: string | null }[] }>(
      page,
      "board.get",
    );
    expect(board.relationships).toEqual([
      expect.objectContaining({ starts: null, ends: first.id }),
    ]);
    await page.keyboard.press("Escape");

    // In the threads, the second chapter no longer has it.
    await page.keyboard.press("F8");
    await threads.getByRole("button", { name: "Capítulo 2: El camino" }).click();
    await expect(threads.getByText(/Ninguna relación de estas fichas/)).toBeVisible();
    await threads.getByRole("button", { name: /^Capítulo 1:/ }).click();
    await expect(threads.getByRole("list", { name: "Relaciones vigentes" })).toContainText(
      "Claudio hijo de Antonio",
    );

    // The squire proposes a milestone, and accepting it marks it at its paragraph.
    await call(page, "squire.configure", {
      provider: "compatible",
      model: "modelo-de-prueba",
      endpoint: provider.address,
      origin: "seed",
    });
    await call(page, "squire.setKey", { provider: "compatible", key: KEY, origin: "seed" });
    await call(page, "squire.enable", { enabled: true, origin: "seed" });
    await page.keyboard.press("F8");
    await chapterText(page).locator("p").nth(1).click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type(JOURNEY);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^Escudero · / }).click();
    const squire = page.getByRole("complementary", { name: "Escudero" });
    const proposal = squire
      .getByRole("listitem")
      .filter({ hasText: "Hito de Antonio: Parte hacia Madrid" });
    await expect(proposal.first()).toBeVisible();
    await proposal.first().getByRole("button", { name: "Aceptar" }).click();

    await page.keyboard.press("F8");
    await expect(
      threads.getByRole("button", { name: "Hito de Antonio: Parte hacia Madrid" }),
    ).toBeVisible();
    const view = await call<{ milestones: { text: string; passage: string; lost: boolean }[] }>(
      page,
      "threads.get",
    );
    expect(view.milestones.map((milestone) => milestone.text)).toEqual(
      expect.arrayContaining(["Muere su padre", "Parte hacia Madrid"]),
    );
    expect(view.milestones.find((milestone) => milestone.text === "Muere su padre")).toMatchObject({
      passage: DEATH,
      lost: false,
    });

    await desk.close(app);
  } finally {
    provider.server.close();
  }
});

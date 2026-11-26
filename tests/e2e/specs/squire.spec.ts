import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { call } from "../support/book";
import { chapterText, createWork, expect, test } from "../support/desk";

const KEY = "clave-de-prueba";
const PARAGRAPH = "Antonio llegó con su hijo Claudio, pelirrojo como él.";
const ANSWER = JSON.stringify({
  elements: [{ name: "Claudio", kind: "character" }],
  relationships: [{ from: "Claudio", to: "Antonio", forward: "hijo de", inverse: "padre de" }],
  attributes: [{ element: "Antonio", name: "Pelo", value: "pelirrojo" }],
});

/** A provider compatible with OpenAI on this computer: it answers what the squire should deduce. */
async function fakeProvider(): Promise<{ server: Server; address: string; asked: string[] }> {
  const asked: string[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (request.headers.authorization !== `Bearer ${KEY}`) {
        response.writeHead(401).end();
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        messages: { role: string; content: string }[];
      };
      asked.push(body.messages.at(-1)!.content);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ choices: [{ message: { role: "assistant", content: ANSWER } }] }),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return { server, address: `http://127.0.0.1:${port}/v1`, asked };
}

function squirePanel(page: Page) {
  return page.getByRole("complementary", { name: "Escudero" });
}

function proposal(page: Page, text: string | RegExp) {
  return squirePanel(page).getByRole("listitem").filter({ hasText: text });
}

test("the squire: connected with the writer's key, it proposes and the writer decides", async ({
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

    // Connected: a compatible provider, its address, the model and the key; «Probar» says it works.
    await page.getByRole("button", { name: "Escudero", exact: true }).click();
    const panel = squirePanel(page);
    await expect(panel.getByRole("status").first()).toHaveText("Sin conectar.");
    await panel.getByLabel("Inteligencia artificial").selectOption("compatible");
    await panel.getByLabel("Modelo").fill("modelo-de-prueba");
    await panel.getByLabel("Dirección").fill(provider.address);
    await panel.getByRole("button", { name: "Guardar", exact: true }).click();
    await panel.getByLabel("Tu clave").fill(KEY);
    await panel.getByRole("button", { name: "Guardar clave" }).click();
    await expect(panel.getByText("Guardada en el almacén del sistema.")).toBeVisible();
    await panel.getByRole("button", { name: "Probar" }).click();
    await expect(panel.getByText(/^Funciona/)).toBeVisible();

    // Off until the writer, told where the text goes, turns it on for this work.
    await expect(panel.getByText(/irán a Compatible con OpenAI/)).toBeVisible();
    const before = provider.asked.length;
    const reads = panel.getByRole("checkbox", { name: "El escudero lee esta obra" });
    await reads.click();
    await expect(reads).toBeChecked();
    await panel.getByRole("button", { name: "Propuestas" }).click();

    // A paragraph finished with Intro: the proposals arrive, with their passage, and nothing else moves.
    await chapterText(page).click();
    await page.keyboard.type(PARAGRAPH);
    await page.keyboard.press("Enter");
    await expect(proposal(page, "Ficha nueva: Claudio")).toBeVisible();
    await expect(squirePanel(page).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Escudero · 3" })).toBeVisible();
    expect(provider.asked.slice(before)).toHaveLength(1);
    expect(provider.asked.at(-1)).toContain(PARAGRAPH);
    expect(provider.asked.at(-1)).toContain("Antonio");
    await expect(chapterText(page)).toContainText(PARAGRAPH);

    // Accepted: the ficha. Corrected and accepted: the attribute. Dismissed: the relationship.
    await proposal(page, "Ficha nueva: Claudio").getByRole("button", { name: "Aceptar" }).click();
    await expect(proposal(page, "Ficha nueva: Claudio")).toHaveCount(0);
    await proposal(page, "Pelo").getByRole("button", { name: "Corregir" }).click();
    await squirePanel(page).getByLabel("Pelo").fill("pelirrojo y rizado");
    await squirePanel(page).getByRole("button", { name: "Aceptar así" }).click();
    await proposal(page, "es hijo de").getByRole("button", { name: "Descartar" }).click();
    await expect(squirePanel(page).getByText(/Sin propuestas/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Escudero", exact: true })).toBeVisible();

    const board = await call<{ elements: { name: string }[]; relationships: unknown[] }>(
      page,
      "board.get",
    );
    expect(board.elements.map((element) => element.name).sort()).toEqual(["Antonio", "Claudio"]);
    expect(board.relationships).toHaveLength(0);
    const sheet = await call<{ attributes: { name: string; value: string }[] }>(
      page,
      "element.get",
      { id: antonio.id },
    );
    expect(sheet.attributes).toContainEqual({ name: "Pelo", value: "pelirrojo y rizado" });

    // The same paragraph is not read again, and what was dismissed does not come back.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    expect(provider.asked.slice(before)).toHaveLength(1);
    expect(await call<unknown[]>(page, "proposals.get")).toHaveLength(0);

    await desk.close(app);
  } finally {
    provider.server.close();
  }
});

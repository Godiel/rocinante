/**
 * The test relay: what the Tauri host does for a window, done by Node for a browser page.
 *
 * It starts the real .NET core, writes each request from the page to its stdin as one JSON-RPC
 * line, hands the matching answer back, and passes the core's notifications to the page as
 * server-sent events. It also serves the built interface, so page and relay share one origin.
 *
 * The Rust relay has its own tests; this one exists so the interface and the core can be tested
 * together in a browser, which Playwright drives the same way on every system.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, resolve, sep } from "node:path";
import { createInterface } from "node:readline";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const INTERFACE = join(ROOT, "src", "ui", "dist");
export const CORE_LIBRARY = join(
  ROOT,
  "src",
  "core",
  "Rocinante.Sidecar",
  "bin",
  "Release",
  "net10.0",
  "Rocinante.Sidecar.dll",
);

/** Same code as the host uses for "the core is not there right now". */
const CORE_UNAVAILABLE = -32000;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

type Reply = { result: unknown } | { error: unknown };

export interface Relay {
  /** Where the page is served. */
  readonly url: string;
  /** Resolves when the page destroyed its window, which it does after saving on close. */
  readonly windowClosed: Promise<void>;
  /** Ends the core the hard way, as a power cut or a killed process would. */
  killCore(): Promise<void>;
  /** Closes the core's input, as the host does when the app closes, and stops serving. */
  stop(): Promise<void>;
}

function coreCommand(dataDirectory: string): [string, string[]] {
  const args = ["--data-dir", dataDirectory];
  const custom = process.env.ROCINANTE_CORE;
  if (custom) return [custom, args];
  return ["dotnet", [CORE_LIBRARY, ...args]];
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
    request.on("error", fail);
  });
}

function sendJson(response: ServerResponse, body: unknown) {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function serveFile(path: string, response: ServerResponse) {
  const relative = normalize(decodeURIComponent(path)).replace(/^[\\/]+/, "");
  let file = join(INTERFACE, relative);
  if (!file.startsWith(INTERFACE + sep) || !existsSync(file) || relative === "") {
    file = join(INTERFACE, "index.html");
  }
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  response.end(readFileSync(file));
}

/** Starts a core on `dataDirectory` and a server for one page. */
export async function startRelay(dataDirectory: string): Promise<Relay> {
  const [command, args] = coreCommand(dataDirectory);
  const core: ChildProcessWithoutNullStreams = spawn(command, args, { stdio: "pipe" });
  const exited = new Promise<void>((done) => core.once("exit", () => done()));
  let running = true;
  let nextId = 1;
  const pending = new Map<number, (reply: Reply) => void>();
  const streams = new Set<ServerResponse>();
  const errors: string[] = [];

  core.stderr.setEncoding("utf8");
  core.stderr.on("data", (text: string) => errors.push(text));

  void exited.then(() => {
    running = false;
    for (const answer of pending.values()) {
      answer({ error: { code: CORE_UNAVAILABLE, message: "core unavailable: it stopped" } });
    }
    pending.clear();
  });

  createInterface({ input: core.stdout }).on("line", (line) => {
    let message: { id?: number; method?: string; result?: unknown; error?: unknown };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const answer = pending.get(message.id);
      pending.delete(message.id);
      answer?.("error" in message ? { error: message.error } : { result: message.result ?? null });
    } else if (message.method) {
      const event = `data: ${JSON.stringify({ event: "core://notification", payload: message })}\n\n`;
      for (const stream of streams) stream.write(event);
    }
  });

  function ask(method: string, params: unknown): Promise<Reply> {
    if (!running) {
      return Promise.resolve({
        error: { code: CORE_UNAVAILABLE, message: "core unavailable: it stopped" },
      });
    }
    const id = nextId++;
    const message: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== null && params !== undefined) message.params = params;
    return new Promise((answer) => {
      pending.set(id, answer);
      core.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  let closeWindow: () => void = () => {};
  const windowClosed = new Promise<void>((done) => (closeWindow = done));

  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://relay");
      if (request.method === "POST" && url.pathname === "/rpc") {
        const { method, params } = JSON.parse(await readBody(request)) as {
          method: string;
          params: unknown;
        };
        sendJson(response, await ask(method, params));
      } else if (request.method === "POST" && url.pathname === "/window/destroy") {
        closeWindow();
        sendJson(response, { result: null });
      } else if (url.pathname === "/events") {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
        });
        response.write(": connected\n\n");
        streams.add(response);
        request.on("close", () => streams.delete(response));
      } else {
        serveFile(url.pathname, response);
      }
    })().catch((error: unknown) => {
      response.writeHead(500);
      response.end(String(error));
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;

  // The core answers its first request only once it is ready; that is the start.
  const ping = await ask("system.info", null);
  if ("error" in ping) {
    throw new Error(`The core did not start: ${JSON.stringify(ping.error)}\n${errors.join("")}`);
  }

  async function closeServer() {
    for (const stream of streams) stream.end();
    streams.clear();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }

  return {
    url: `http://127.0.0.1:${port}/`,
    windowClosed,
    async killCore() {
      if (running) core.kill("SIGKILL");
      await exited;
    },
    async stop() {
      if (running) core.stdin.end();
      await exited;
      await closeServer();
    },
  };
}

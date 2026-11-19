import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

import { CoreError, ensureCompatibleCore, request } from "./core";
import { ErrorCodes, PROTOCOL_VERSION } from "./generated/protocol";

/** Awaits a promise that must reject with a CoreError and returns that error. */
async function failureOf(promise: Promise<unknown>): Promise<CoreError> {
  const caught = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(CoreError);
  return caught as CoreError;
}

describe("bridge to the core", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("sends the method and params through the relay command", async () => {
    invoke.mockResolvedValue({ id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b" });
    const params = { kind: "chapter" as const, title: "Capítulo primero", origin: "main" };

    await expect(request("document.create", params)).resolves.toEqual({
      id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
    });
    expect(invoke).toHaveBeenCalledWith("core_request", { method: "document.create", params });
  });

  it("sends null params for methods without params", async () => {
    invoke.mockResolvedValue("pong");

    await request("system.ping");

    expect(invoke).toHaveBeenCalledWith("core_request", { method: "system.ping", params: null });
  });

  it("turns JSON-RPC errors into CoreError", async () => {
    invoke.mockImplementation(() =>
      Promise.reject({ code: ErrorCodes.InvalidParams, message: "Invalid params" }),
    );

    const error = await failureOf(request("system.ping"));

    expect(error.code).toBe(ErrorCodes.InvalidParams);
    expect(error.message).toBe("Invalid params");
    expect(error.reason).toBeUndefined();
  });

  it("keeps the reason of an expected failure", async () => {
    invoke.mockImplementation(() =>
      Promise.reject({
        code: ErrorCodes.ProjectFileProblem,
        message: "The file is not a SQLite database.",
        data: { reason: "notAProject" },
      }),
    );

    const error = await failureOf(request("project.open", { path: "carta.txt", origin: "main" }));

    expect(error.code).toBe(ErrorCodes.ProjectFileProblem);
    expect(error.reason).toBe("notAProject");
  });

  it("reports an unreachable core as CoreUnavailable", async () => {
    invoke.mockImplementation(() => Promise.reject("relay gone"));

    const error = await failureOf(request("system.ping"));

    expect(error.code).toBe(ErrorCodes.CoreUnavailable);
    expect(error.message).toBe("relay gone");
  });

  it("accepts a core that speaks the same protocol version", async () => {
    invoke.mockResolvedValue({ protocolVersion: PROTOCOL_VERSION, coreVersion: "0.1.0" });

    await expect(ensureCompatibleCore()).resolves.toBeUndefined();
  });

  it("refuses a core that speaks another protocol version", async () => {
    invoke.mockResolvedValue({ protocolVersion: PROTOCOL_VERSION + 1, coreVersion: "9.9.9" });

    await expect(ensureCompatibleCore()).rejects.toThrow(/Protocol mismatch/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreError } from "../bridge/core";
import { ErrorCodes } from "../bridge/generated/protocol";
import { messageFor, messages } from "./messages";

const protocol = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "..", "contracts", "protocol.json"), "utf8"),
) as { $defs: { ErrorReason: { enum: string[] } } };

describe("messages for the writer", () => {
  it("cover every reason the core can give, in plain sentences", () => {
    expect(Object.keys(messages).sort()).toEqual([...protocol.$defs.ErrorReason.enum].sort());
    for (const message of Object.values(messages)) {
      expect(message).toMatch(/^[A-ZÁÉÍÓÚÑ¿¡].*\.$/);
    }
  });

  it("use the reason when there is one", () => {
    const error = new CoreError(ErrorCodes.ProjectFileProblem, "not a project", "notAProject");

    expect(messageFor(error)).toBe(messages.notAProject);
  });

  it("say the core is not answering when the relay cannot reach it", () => {
    expect(messageFor(new CoreError(ErrorCodes.CoreUnavailable, "gone"))).toContain("no responde");
  });

  it("never show technical details otherwise", () => {
    expect(messageFor(new Error("SqliteException: database is locked"))).toBe(
      "Algo no ha ido bien. Vuelve a intentarlo; lo guardado está a salvo.",
    );
  });
});

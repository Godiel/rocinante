import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, ErrorCodes } from "./generated/protocol";

// The UI side of the contract tests: the same examples the core validates must
// pass (or fail) here too, and the generated types must match the contract file.

const contractsDir = join(import.meta.dirname, "..", "..", "..", "contracts");

interface MethodEntry {
  params: object | null;
  result: object;
}

interface Protocol {
  protocolVersion: number;
  errorCodes: Record<string, number>;
  methods: Record<string, MethodEntry>;
  notifications: Record<string, { params: object }>;
  $defs: Record<string, object>;
}

interface Examples {
  valid: unknown[];
  invalid: unknown[];
}

const protocol = JSON.parse(readFileSync(join(contractsDir, "protocol.json"), "utf8")) as Protocol;

const examplesOf = (method: string): Examples | undefined => {
  const path = join(contractsDir, "examples", `${method}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Examples) : undefined;
};

const paramsValidator = (method: string) => {
  const entry = protocol.methods[method];
  if (!entry) throw new Error(`Unknown method ${method}`);
  const schema = entry.params ?? { type: "null" };
  return new Ajv2020({ strict: true }).compile({ ...schema, $defs: protocol.$defs });
};

const methodsWithParams = Object.entries(protocol.methods)
  .filter(([, entry]) => entry.params !== null)
  .map(([method]) => method);

describe("protocol contract", () => {
  it("generated types match the contract version and error codes", () => {
    expect(PROTOCOL_VERSION).toBe(protocol.protocolVersion);
    expect(ErrorCodes).toEqual(protocol.errorCodes);
  });

  it("every schema in the contract compiles", () => {
    const ajv = new Ajv2020({ strict: true });
    const compile = (schema: object) => ajv.compile({ ...schema, $defs: protocol.$defs });

    for (const entry of Object.values(protocol.methods)) {
      if (entry.params) compile(entry.params);
      compile(entry.result);
    }
    for (const entry of Object.values(protocol.notifications)) compile(entry.params);
  });

  it.each(methodsWithParams)("%s has shared examples", (method) => {
    const examples = examplesOf(method);
    expect(examples?.valid.length).toBeGreaterThan(0);
    expect(examples?.invalid.length).toBeGreaterThan(0);
  });

  describe.each(methodsWithParams)("%s examples", (method) => {
    const examples = examplesOf(method) ?? { valid: [], invalid: [] };
    const validate = paramsValidator(method);

    it.each(examples.valid.map((example, index) => [index, example]))(
      "accepts valid example %i",
      (_, example) => {
        expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
      },
    );

    it.each(examples.invalid.map((example, index) => [index, example]))(
      "rejects invalid example %i",
      (_, example) => {
        expect(validate(example)).toBe(false);
      },
    );
  });
});

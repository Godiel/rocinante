import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/core", () => ({ request }));

import type { Relationship } from "../../bridge/generated/protocol";
import { changeRelationship, kindOptions, newKindOf, optionRepeats, relate } from "./relate";

const mentor = { id: "own:1", forward: "maestro de", inverse: "discípulo de" };
const childOf: Relationship = {
  id: "r",
  from: "c",
  to: "a",
  kind: "builtin:child-of",
  starts: null,
  ends: null,
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ id: "new" });
});

describe("the ways to read a relationship", () => {
  it("offers each kind forward, and backward when it has an inverse", () => {
    const options = kindOptions([mentor]);
    const labels = options.map((option) => option.label);

    expect(labels).toContain("hijo de");
    expect(options.find((option) => option.label === "padre de")).toMatchObject({
      kind: "builtin:child-of",
      swap: true,
    });
    expect(labels.filter((label) => label === "hermano de")).toHaveLength(1);
    expect(options.filter((option) => option.own).map((option) => option.label)).toEqual([
      "maestro de",
      "discípulo de",
    ]);
  });

  it("knows which would repeat a relationship there is", () => {
    const [son, father] = kindOptions([]).filter((option) => option.kind === "builtin:child-of");

    expect(optionRepeats(son!, "c", "a", [childOf], [])).toBe(true);
    expect(optionRepeats(father!, "a", "c", [childOf], [])).toBe(true);
    expect(optionRepeats(father!, "c", "a", [childOf], [])).toBe(false);
    expect(optionRepeats(son!, "c", "a", [childOf], [], "r")).toBe(false);
  });

  it("makes a pair symmetric when the other side is empty or the same", () => {
    expect(newKindOf(" maestro de ", " discípulo de")).toEqual({
      forward: "maestro de",
      inverse: "discípulo de",
    });
    expect(newKindOf("vecino de", "")).toEqual({ forward: "vecino de", inverse: null });
    expect(newKindOf("vecino de", "vecino de ")).toEqual({ forward: "vecino de", inverse: null });
  });
});

describe("relating fichas", () => {
  it("swaps the fichas when the writer reads the kind backward", async () => {
    await relate("a", "c", { kind: "builtin:child-of", swap: true }, "main");

    expect(request).toHaveBeenCalledWith("relationship.create", {
      from: "c",
      to: "a",
      kind: "builtin:child-of",
      origin: "main",
    });
  });

  it("sends a pair the writer wrote", async () => {
    await relate("a", "c", { newKind: { forward: "maestro de", inverse: null } }, "main");

    expect(request).toHaveBeenCalledWith("relationship.create", {
      from: "a",
      to: "c",
      newKind: { forward: "maestro de", inverse: null },
      origin: "main",
    });
  });

  it("changes the kind in place, and turns it round by making the new one before taking the old", async () => {
    await changeRelationship(childOf, { kind: "builtin:friend-of", swap: false }, "main");
    expect(request).toHaveBeenLastCalledWith("relationship.update", {
      id: "r",
      kind: "builtin:friend-of",
      origin: "main",
    });

    request.mockClear();
    await changeRelationship(childOf, { kind: "builtin:child-of", swap: true }, "main");
    expect(request.mock.calls.map(([method]) => method)).toEqual([
      "relationship.create",
      "relationship.delete",
    ]);
    expect(request.mock.calls[0]![1]).toMatchObject({ from: "a", to: "c" });
  });

  it("leaves the old relationship if the new one cannot be made", async () => {
    request.mockRejectedValueOnce(new Error("repeated"));

    await expect(
      changeRelationship(childOf, { kind: "builtin:child-of", swap: true }, "main"),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalledWith("relationship.delete", expect.anything());
  });
});

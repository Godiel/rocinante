// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ambience, OwnAmbience, Theme } from "../../bridge/generated/protocol";

const request = vi.fn();
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
}));

import { CoreError } from "../../bridge/core";
import { contrastRatio } from "../../design/contrast";
import { themes } from "../../design/themes";
import { DEFAULT_AMBIENCE } from "./defaults";
import { AmbienceSheet } from "./AmbienceSheet";
import {
  BUILT_IN_BACKDROPS,
  DEFAULT_BACKDROP,
  backdropOf,
  backdrops,
  paintOf,
  type Backdrop,
} from "./catalog";
import { SHEET_OPACITY, blend, sheetColour } from "./sheet";

afterEach(() => {
  cleanup();
  request.mockReset();
});

const BODY_TEXT = 4.5;

describe("the translucent sheet", () => {
  // Whatever the background, the paper under the text lets through at most this much of it; the
  // worst a background can be is pure white or pure black.
  describe.each(Object.keys(themes) as Theme[])("in the %s theme", (theme) => {
    const palette = themes[theme];

    it.each([
      ["ink", "#000000"],
      ["ink", "#FFFFFF"],
      ["inkSoft", "#000000"],
      ["inkSoft", "#FFFFFF"],
      ["rubric", "#000000"],
      ["rubric", "#FFFFFF"],
    ] as const)("keeps %s at AA over %s", (text, under) => {
      const seen = blend(palette.paper, SHEET_OPACITY[theme], under);
      expect(contrastRatio(palette[text], seen)).toBeGreaterThanOrEqual(BODY_TEXT);
    });

    it("lets something of the background through", () => {
      expect(SHEET_OPACITY[theme]).toBeLessThan(1);
      expect(sheetColour(theme)).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.\d+\)$/);
    });
  });

  it("blends as the eye does", () => {
    expect(blend("#FFFFFF", 0.5, "#000000")).toBe("#808080");
    expect(blend("#F5EFE3", 1, "#000000")).toBe("#f5efe3");
  });
});

describe("the backgrounds", () => {
  const own: OwnAmbience[] = [
    {
      id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
      kind: "image",
      name: "molinos.jpg",
      file: "C:\\datos\\ambience\\a.jpg",
    },
    {
      id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6c",
      kind: "sound",
      name: "lluvia.ogg",
      file: "C:\\datos\\ambience\\b.ogg",
    },
  ];
  const all = backdrops(own, (file) => `asset://${file}`);

  it("start with the paper, and every built-in one has a name and an id of the contract's shape", () => {
    expect(BUILT_IN_BACKDROPS[0]?.id).toBe(DEFAULT_BACKDROP);
    expect(DEFAULT_AMBIENCE.background).toBe(DEFAULT_BACKDROP);
    for (const backdrop of BUILT_IN_BACKDROPS) {
      expect(backdrop.id).toMatch(/^builtin:[a-z0-9-]{1,40}$/);
      expect(backdrop.name).not.toBe("");
    }
    expect(new Set(BUILT_IN_BACKDROPS.map((backdrop) => backdrop.id)).size).toBe(
      BUILT_IN_BACKDROPS.length,
    );
  });

  it("include the writer's own images, but not their sounds", () => {
    const mine = all.filter((backdrop) => backdrop.id.startsWith("own:"));
    expect(mine).toEqual([
      expect.objectContaining({
        id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
        name: "molinos.jpg",
        url: "asset://C:\\datos\\ambience\\a.jpg",
      }),
    ]);
  });

  it("show one that is not there any more as the paper", () => {
    expect(backdropOf("builtin:volcan", all).id).toBe(DEFAULT_BACKDROP);
    expect(backdropOf("own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6d", all).id).toBe(DEFAULT_BACKDROP);
    expect(backdropOf("builtin:dusk", all).name).toBe("Atardecer manchego");
  });

  it("paint differently by day and by night, and the paper not at all", () => {
    const dusk = backdropOf("builtin:dusk", all);
    expect(paintOf(dusk, "paper")).not.toBe(paintOf(dusk, "candlelight"));
    expect(paintOf(backdropOf(DEFAULT_BACKDROP, all), "paper")).toBeNull();
    expect(paintOf(backdropOf(`own:${own[0]!.id}`, all), "candlelight")).toContain(
      'url("asset://C:\\datos\\ambience\\a.jpg")',
    );
  });
});

describe("the ambience sheet", () => {
  const show = (ambience: Ambience = DEFAULT_AMBIENCE, all: Backdrop[] = BUILT_IN_BACKDROPS) => {
    const onProblem = vi.fn();
    const onClose = vi.fn();
    render(
      <AmbienceSheet
        ambience={ambience}
        backdrops={all}
        theme="paper"
        origin="main"
        onClose={onClose}
        onProblem={onProblem}
      />,
    );
    return { onProblem, onClose };
  };

  it("shows every background with the chosen one checked", () => {
    show({ ...DEFAULT_AMBIENCE, background: "builtin:olive" });

    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(BUILT_IN_BACKDROPS.length);
    expect(screen.getByRole("radio", { name: "Olivar" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Papel" })).toHaveAttribute("aria-checked", "false");
  });

  it("checks the paper when the chosen background is gone", () => {
    show({ ...DEFAULT_AMBIENCE, background: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b" });

    expect(screen.getByRole("radio", { name: "Papel" })).toHaveAttribute("aria-checked", "true");
  });

  it("changes the writer's ambience at once, and only the background", async () => {
    request.mockResolvedValue(DEFAULT_AMBIENCE);
    const ambience: Ambience = {
      ...DEFAULT_AMBIENCE,
      dimOthers: true,
      goal: { kind: "words", amount: 500 },
    };
    const { onProblem } = show(ambience);

    await userEvent.click(screen.getByRole("radio", { name: "Noche de ronda" }));

    expect(request).toHaveBeenCalledWith("preferences.update", {
      changes: { ambience: { ...ambience, background: "builtin:night" } },
      origin: "main",
    });
    expect(onProblem).toHaveBeenCalledWith(null);
  });

  it("does not send the background already chosen", async () => {
    show();

    await userEvent.click(screen.getByRole("radio", { name: "Papel" }));

    expect(request).not.toHaveBeenCalled();
  });

  it("says why a change was refused", async () => {
    request.mockRejectedValue(new CoreError(-32002, "gone", "ambienceNotFound"));
    const { onProblem } = show();

    await userEvent.click(screen.getByRole("radio", { name: "Olivar" }));

    expect(onProblem).toHaveBeenCalledWith(
      "Ese fondo o sonido ya no está. Puede que se haya quitado en otra ventana.",
    );
  });

  it("closes with Escape", async () => {
    const { onClose } = show();

    await userEvent.click(screen.getByRole("radio", { name: "Papel" }));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ambience, OwnAmbience, Theme } from "../../bridge/generated/protocol";

const request = vi.fn();
const sounds = vi.hoisted(() => ({ setTyping: vi.fn(), play: vi.fn() }));
vi.mock("../../audio/engine", () => ({ sounds }));
vi.mock("../../bridge/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../bridge/core")>()),
  request: (...args: unknown[]) => request(...args) as unknown,
}));

import { CoreError } from "../../bridge/core";
import { contrastRatio } from "../../design/contrast";
import { themes } from "../../design/themes";
import { DEFAULT_AMBIENCE } from "./defaults";
import type { Pickers } from "../welcome/Welcome";
import { BUILT_IN_AMBIENTS } from "../../audio/ambient-sounds";
import { AmbienceSheet, SEND_DELAY_MS } from "./AmbienceSheet";
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
  sounds.setTyping.mockReset();
  sounds.play.mockReset();
});

const BODY_TEXT = 4.5;
/** Dialogs where the writer cancels; a test that needs a file gives its own. */
const noPickers: Pick<Pickers, "chooseImage" | "chooseSound"> = {
  chooseImage: () => Promise.resolve(null),
  chooseSound: () => Promise.resolve(null),
};

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
  const all = backdrops(own, (file) => `ambience://${file}`);

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
        url: "ambience://C:\\datos\\ambience\\a.jpg",
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
      'url("ambience://C:\\datos\\ambience\\a.jpg")',
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
        ambients={BUILT_IN_AMBIENTS}
        playsAmbients
        pickers={noPickers}
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

    const options = within(screen.getByRole("radiogroup", { name: "Fondo" })).getAllByRole("radio");
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

describe("the typing in the ambience sheet", () => {
  const show = (ambience: Ambience = DEFAULT_AMBIENCE) => {
    request.mockResolvedValue(ambience);
    return render(
      <AmbienceSheet
        ambience={ambience}
        backdrops={BUILT_IN_BACKDROPS}
        ambients={BUILT_IN_AMBIENTS}
        playsAmbients
        pickers={noPickers}
        theme="paper"
        origin="main"
        onClose={() => {}}
        onProblem={() => {}}
      />,
    );
  };
  const sent = () =>
    request.mock.calls.map(
      ([, params]) => (params as { changes: { ambience: Ambience } }).changes.ambience,
    );

  it("chooses a typing sound, lets it be heard at once, and unmutes it", async () => {
    show();

    await userEvent.click(screen.getByRole("radio", { name: "Lápiz sobre papel" }));

    expect(sent()).toEqual([
      { ...DEFAULT_AMBIENCE, typing: { ...DEFAULT_AMBIENCE.typing, sound: "quill", muted: false } },
    ]);
    expect(sounds.setTyping).toHaveBeenCalledWith({ sound: "quill", volume: 0.6, muted: false });
    expect(sounds.play).toHaveBeenCalledWith("key");
    expect(screen.getByRole("radio", { name: "Lápiz sobre papel" })).toBeChecked();
  });

  it("sends a volume once it rests, not at every step of the slider", () => {
    vi.useFakeTimers();
    try {
      show();
      const slider = screen.getByRole("slider", { name: "Volumen del tecleo" });

      for (const value of ["50", "40", "30"]) fireEvent.change(slider, { target: { value } });
      expect(request).not.toHaveBeenCalled();
      expect(slider).toHaveValue("30");
      expect(sounds.play).toHaveBeenCalledTimes(3);

      act(() => void vi.advanceTimersByTime(SEND_DELAY_MS));
      expect(sent()).toEqual([
        { ...DEFAULT_AMBIENCE, typing: { ...DEFAULT_AMBIENCE.typing, volume: 0.3, muted: false } },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not lose a resting volume when the sheet closes", () => {
    vi.useFakeTimers();
    try {
      const view = show();
      fireEvent.change(screen.getByRole("slider", { name: "Volumen del tecleo" }), {
        target: { value: "80" },
      });

      view.unmount();

      expect(sent()).toEqual([
        { ...DEFAULT_AMBIENCE, typing: { ...DEFAULT_AMBIENCE.typing, volume: 0.8, muted: false } },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mutes and unmutes, keeping the volume", async () => {
    show({ ...DEFAULT_AMBIENCE, typing: { sound: "mechanical", volume: 0.35, muted: false } });

    await userEvent.click(
      within(screen.getByRole("region", { name: "Tecleo" })).getByRole("checkbox", {
        name: "Silencio",
      }),
    );

    expect(sent()).toEqual([
      { ...DEFAULT_AMBIENCE, typing: { sound: "mechanical", volume: 0.35, muted: true } },
    ]);
  });
});

describe("the ambient sounds in the ambience sheet", () => {
  const show = (ambience: Ambience = DEFAULT_AMBIENCE, playsAmbients = true) => {
    request.mockResolvedValue(ambience);
    return render(
      <AmbienceSheet
        ambience={ambience}
        backdrops={BUILT_IN_BACKDROPS}
        ambients={BUILT_IN_AMBIENTS}
        playsAmbients={playsAmbients}
        pickers={noPickers}
        theme="paper"
        origin="main"
        onClose={() => {}}
        onProblem={() => {}}
      />,
    );
  };
  const sent = () =>
    request.mock.calls.map(
      ([, params]) => (params as { changes: { ambience: Ambience } }).changes.ambience,
    );

  it("adds an ambient to the mix at a gentle level, and takes it out", async () => {
    show({ ...DEFAULT_AMBIENCE, ambientMuted: true });

    await userEvent.click(screen.getByRole("checkbox", { name: "Lluvia" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Chimenea" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Lluvia" }));

    expect(sent().map((ambience) => ambience.ambients)).toEqual([
      [{ id: "builtin:rain", level: 0.7 }],
      [
        { id: "builtin:rain", level: 0.7 },
        { id: "builtin:fire", level: 0.7 },
      ],
      [{ id: "builtin:fire", level: 0.7 }],
    ]);
    expect(sent()[0]?.ambientMuted).toBe(false);
  });

  it("gives each ambient that plays its own level, sent once it rests", () => {
    vi.useFakeTimers();
    try {
      show({ ...DEFAULT_AMBIENCE, ambients: [{ id: "builtin:cafe", level: 0.5 }] });
      expect(screen.queryByRole("slider", { name: "Nivel de Lluvia" })).toBeNull();
      const level = screen.getByRole("slider", { name: "Nivel de Café" });

      fireEvent.change(level, { target: { value: "20" } });
      fireEvent.change(level, { target: { value: "10" } });
      act(() => void vi.advanceTimersByTime(SEND_DELAY_MS));

      expect(sent().map((ambience) => ambience.ambients)).toEqual([
        [{ id: "builtin:cafe", level: 0.1 }],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets no more than six play at once", () => {
    const six = Array.from({ length: 6 }, (_, at) => ({ id: `builtin:own-${at}`, level: 1 }));
    show({ ...DEFAULT_AMBIENCE, ambients: six });

    for (const sound of BUILT_IN_AMBIENTS) {
      expect(screen.getByRole("checkbox", { name: sound.name })).toBeDisabled();
    }
  });

  it("has a volume and a silence for all of them", async () => {
    show();

    await userEvent.click(
      within(screen.getByRole("region", { name: "Ambientes" })).getByRole("checkbox", {
        name: "Silencio",
      }),
    );

    expect(sent()).toEqual([{ ...DEFAULT_AMBIENCE, ambientMuted: true }]);
    expect(screen.getByRole("slider", { name: "Volumen de los ambientes" })).toHaveValue("60");
  });

  it("says where they play in another window", () => {
    show(DEFAULT_AMBIENCE, false);

    expect(screen.getByText("Suenan en la ventana principal.")).toBeInTheDocument();
  });
});

describe("focus aids in the ambience sheet", () => {
  const show = (ambience: Ambience = DEFAULT_AMBIENCE) => {
    request.mockResolvedValue(ambience);
    return render(
      <AmbienceSheet
        ambience={ambience}
        backdrops={BUILT_IN_BACKDROPS}
        ambients={BUILT_IN_AMBIENTS}
        playsAmbients
        pickers={noPickers}
        theme="paper"
        origin="main"
        onClose={() => {}}
        onProblem={() => {}}
      />,
    );
  };
  const sent = () =>
    request.mock.calls.map(
      ([, params]) => (params as { changes: { ambience: Ambience } }).changes.ambience,
    );

  it("dims the rest or not", async () => {
    show();

    await userEvent.click(screen.getByRole("checkbox", { name: /Atenuar el resto/ }));

    expect(sent()).toEqual([{ ...DEFAULT_AMBIENCE, dimOthers: true }]);
  });

  it("sets a goal of words or of minutes, starting from a sensible amount", async () => {
    show();
    expect(screen.queryByRole("spinbutton")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "Palabras nuevas" }));
    await userEvent.click(screen.getByRole("radio", { name: "Minutos escribiendo" }));
    await userEvent.click(screen.getByRole("radio", { name: "Sin meta" }));

    expect(sent().map((ambience) => ambience.goal)).toEqual([
      { kind: "words", amount: 500 },
      { kind: "minutes", amount: 45 },
      { kind: "none" },
    ]);
  });

  it("sends an amount within reason once it rests, and says what is allowed otherwise", () => {
    vi.useFakeTimers();
    try {
      show({ ...DEFAULT_AMBIENCE, goal: { kind: "words", amount: 500 } });
      const amount = screen.getByRole("spinbutton", { name: "Meta en palabras" });

      fireEvent.change(amount, { target: { value: "20" } });
      expect(amount).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent("Entre 50 y 50.000 palabras.");

      fireEvent.change(amount, { target: { value: "1200" } });
      act(() => void vi.advanceTimersByTime(SEND_DELAY_MS));

      expect(screen.queryByRole("alert")).toBeNull();
      expect(sent().map((ambience) => ambience.goal)).toEqual([{ kind: "words", amount: 1200 }]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the writer's own files in the ambience sheet", () => {
  const ownImage = {
    id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
    kind: "image" as const,
    name: "molinos.jpg",
    file: "C:/datos/ambience/0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b.jpg",
  };
  const ownSound = {
    ...ownImage,
    id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6c",
    kind: "sound" as const,
    name: "lluvia.ogg",
  };

  const show = (pickers = noPickers, ambience: Ambience = DEFAULT_AMBIENCE) => {
    const onProblem = vi.fn();
    render(
      <AmbienceSheet
        ambience={ambience}
        backdrops={backdrops([ownImage], (file) => file)}
        ambients={[
          ...BUILT_IN_AMBIENTS,
          { id: `own:${ownSound.id}`, name: ownSound.name, url: "x" },
        ]}
        playsAmbients
        pickers={pickers}
        theme="paper"
        origin="main"
        onClose={() => {}}
        onProblem={onProblem}
      />,
    );
    return { onProblem };
  };
  const calls = (method: string) =>
    request.mock.calls
      .filter(([name]) => name === method)
      .map(([, params]) => params as Record<string, unknown>);

  it("copies a chosen image into the app and puts it behind the sheet", async () => {
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "ambience.import"
          ? { ...ownImage, id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6d" }
          : null,
      ),
    );
    show({ ...noPickers, chooseImage: () => Promise.resolve("C:/Imágenes/venta.png") });

    await userEvent.click(screen.getByRole("button", { name: "Añadir una imagen tuya" }));

    expect(calls("ambience.import")).toEqual([
      { path: "C:/Imágenes/venta.png", kind: "image", origin: "main" },
    ]);
    expect(calls("preferences.update")[0]).toMatchObject({
      changes: { ambience: { background: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6d" } },
    });
  });

  it("adds a chosen sound to the mix", async () => {
    request.mockImplementation((method: string) =>
      Promise.resolve(
        method === "ambience.import"
          ? { ...ownSound, id: "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6e" }
          : null,
      ),
    );
    show({ ...noPickers, chooseSound: () => Promise.resolve("/home/autor/olas.flac") });

    await userEvent.click(screen.getByRole("button", { name: "Añadir un sonido tuyo" }));

    expect(calls("ambience.import")[0]).toMatchObject({ kind: "sound" });
    expect(calls("preferences.update")[0]).toMatchObject({
      changes: {
        ambience: { ambients: [{ id: "own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6e", level: 0.7 }] },
      },
    });
  });

  it("does nothing when the writer cancels the dialog", async () => {
    show();

    await userEvent.click(screen.getByRole("button", { name: "Añadir una imagen tuya" }));

    expect(request).not.toHaveBeenCalled();
  });

  it("says in Spanish why a file was refused, and says it is copying meanwhile", async () => {
    let refuse: (error: unknown) => void = () => {};
    request.mockImplementation(() => new Promise((_, reject) => (refuse = reject)));
    const { onProblem } = show({
      ...noPickers,
      chooseSound: () => Promise.resolve("C:/carta.ogg"),
    });

    await userEvent.click(screen.getByRole("button", { name: "Añadir un sonido tuyo" }));
    expect(screen.getByRole("button", { name: "Copiando el sonido…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Añadir una imagen tuya" })).toBeDisabled();

    await act(async () => refuse(new CoreError(-32002, "no", "notASound")));

    expect(onProblem).toHaveBeenLastCalledWith(
      "Ese archivo no es un sonido que Rocinante pueda usar. Prueba con Ogg, MP3, WAV o FLAC.",
    );
    expect(screen.getByRole("button", { name: "Añadir un sonido tuyo" })).toBeEnabled();
  });

  it("takes away an own image or sound, and only those", async () => {
    request.mockResolvedValue([]);
    show();

    await userEvent.click(screen.getByRole("button", { name: "Quitar «molinos.jpg»" }));
    await userEvent.click(screen.getByRole("button", { name: "Quitar «lluvia.ogg»" }));

    expect(calls("ambience.remove")).toEqual([
      { id: ownImage.id, origin: "main" },
      { id: ownSound.id, origin: "main" },
    ]);
    expect(screen.getAllByRole("button", { name: /^Quitar/ })).toHaveLength(2);
  });
});

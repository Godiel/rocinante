import type { OwnAmbience, Theme } from "../../bridge/generated/protocol";
import type { SceneName } from "./animated/scenes";

/** Who made something that comes with the app, and under what licence. */
export interface Credit {
  author: string;
  source: string;
  licence: "CC0-1.0";
}

/** What goes behind the sheet in focus mode. */
export type Backdrop =
  /** The paper of the theme and nothing else: the view as it always is. */
  | { kind: "plain"; id: string; name: string }
  /** A colour or a gradient, one for each theme so night stays night. */
  | { kind: "colour"; id: string; name: string; paint: Record<Theme, string> }
  /** A scene drawn on a canvas over a colour, moving slowly; still if the system asks for less motion. */
  | { kind: "animated"; id: string; name: string; paint: Record<Theme, string>; scene: SceneName }
  /** A picture, built in or the writer's own, shown whole over the window. */
  | { kind: "image"; id: string; name: string; url: string; credit: Credit | null };

export const DEFAULT_BACKDROP = "builtin:parchment";

/** The backgrounds that come with the app, in the order the panel shows them. */
export const BUILT_IN_BACKDROPS: Backdrop[] = [
  { kind: "plain", id: DEFAULT_BACKDROP, name: "Papel" },
  {
    kind: "colour",
    id: "builtin:dusk",
    name: "Atardecer manchego",
    paint: {
      paper: "linear-gradient(170deg, #f2c48d 0%, #e59b78 55%, #b9707a 100%)",
      candlelight: "linear-gradient(170deg, #4a2a1c 0%, #3a1e1d 55%, #241418 100%)",
    },
  },
  {
    kind: "colour",
    id: "builtin:olive",
    name: "Olivar",
    paint: {
      paper: "linear-gradient(180deg, #c9cfa4 0%, #9eaa7a 100%)",
      candlelight: "linear-gradient(180deg, #2b2f1d 0%, #1c2014 100%)",
    },
  },
  {
    kind: "colour",
    id: "builtin:terracotta",
    name: "Barro cocido",
    paint: {
      paper: "radial-gradient(circle at 30% 20%, #e8b796 0%, #c4805f 70%, #a8654a 100%)",
      candlelight: "radial-gradient(circle at 30% 20%, #3d2318 0%, #2a1811 70%, #1f120d 100%)",
    },
  },
  {
    kind: "colour",
    id: "builtin:sea",
    name: "Mar de Barcelona",
    paint: {
      paper: "linear-gradient(180deg, #d6e2e6 0%, #9db8c4 60%, #7d9cab 100%)",
      candlelight: "linear-gradient(180deg, #1a242b 0%, #121b21 60%, #0d1418 100%)",
    },
  },
  {
    kind: "animated",
    id: "builtin:rain-window",
    name: "Lluvia en el cristal",
    scene: "rain",
    paint: {
      paper: "linear-gradient(180deg, #9fb0bb 0%, #7d909c 100%)",
      candlelight: "linear-gradient(180deg, #1b2228 0%, #11171b 100%)",
    },
  },
  {
    kind: "animated",
    id: "builtin:candle",
    name: "Una vela",
    scene: "candle",
    paint: {
      paper: "radial-gradient(circle at 14% 72%, #8a6a4a 0%, #4a3a2c 45%, #2a221b 100%)",
      candlelight: "radial-gradient(circle at 14% 72%, #3a2a1c 0%, #1c1510 45%, #0e0b08 100%)",
    },
  },
  {
    kind: "animated",
    id: "builtin:clouds",
    name: "Nubes lentas",
    scene: "clouds",
    paint: {
      paper: "linear-gradient(180deg, #a9c6dc 0%, #d9e5ec 100%)",
      candlelight: "linear-gradient(180deg, #121a24 0%, #1c2430 100%)",
    },
  },
  {
    kind: "colour",
    id: "builtin:night",
    name: "Noche de ronda",
    paint: {
      paper: "linear-gradient(180deg, #8f9bb8 0%, #5d6a8c 100%)",
      candlelight: "linear-gradient(180deg, #151a2b 0%, #0b0e18 100%)",
    },
  },
];

/**
 * Every background the writer can pick: the built-in ones and their own images. `urlOf` turns
 * the path of an own copy into something the page can load (the host's asset protocol).
 */
export function backdrops(own: OwnAmbience[], urlOf: (file: string) => string): Backdrop[] {
  return [
    ...BUILT_IN_BACKDROPS,
    ...own
      .filter((entry) => entry.kind === "image")
      .map((entry): Backdrop => ({
        kind: "image",
        id: `own:${entry.id}`,
        name: entry.name,
        url: urlOf(entry.file),
        credit: null,
      })),
  ];
}

/** The background with that id, or the paper if it is not there (any more). */
export function backdropOf(id: string, all: Backdrop[]): Backdrop {
  return all.find((backdrop) => backdrop.id === id) ?? BUILT_IN_BACKDROPS[0]!;
}

/** The CSS background of a backdrop in a theme; null for the plain paper. */
export function paintOf(backdrop: Backdrop, theme: Theme): string | null {
  switch (backdrop.kind) {
    case "plain":
      return null;
    case "colour":
    case "animated":
      return backdrop.paint[theme];
    case "image":
      return `center / cover no-repeat url("${backdrop.url.replace(/"/g, "%22")}")`;
  }
}

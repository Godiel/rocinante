import type { Ambient, OwnAmbience } from "../bridge/generated/protocol";
import type { AmbientTrack } from "./engine";

/** An ambient sound the writer can add to the mix. */
export interface AmbientSound {
  id: string;
  name: string;
  url: string;
}

const file = (name: string) => `${import.meta.env.BASE_URL}sounds/ambient/${name}.ogg`;

/**
 * The ambient sounds that come with the app, in the order the panel shows them. Until the CC0
 * recordings arrive they are synthesised placeholders (scripts/placeholder-sounds.mjs).
 */
export const BUILT_IN_AMBIENTS: AmbientSound[] = [
  { id: "builtin:rain", name: "Lluvia", url: file("rain") },
  { id: "builtin:fire", name: "Chimenea", url: file("fire") },
  { id: "builtin:cafe", name: "Café", url: file("cafe") },
  { id: "builtin:field", name: "Campo", url: file("field") },
];

/** Every ambient sound there is: the built-in ones and the writer's own sounds. */
export function ambientSounds(own: OwnAmbience[], urlOf: (file: string) => string): AmbientSound[] {
  return [
    ...BUILT_IN_AMBIENTS,
    ...own
      .filter((entry) => entry.kind === "sound")
      .map((entry) => ({ id: `own:${entry.id}`, name: entry.name, url: urlOf(entry.file) })),
  ];
}

/** What the engine should play for a mix; an ambient that is no longer there is left out. */
export function tracksOf(ambients: Ambient[], all: AmbientSound[]): AmbientTrack[] {
  return ambients.flatMap(({ id, level }) => {
    const sound = all.find((candidate) => candidate.id === id);
    return sound ? [{ id, url: sound.url, level }] : [];
  });
}

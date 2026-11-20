import type { Ambience } from "../../bridge/generated/protocol";

/**
 * The ambience before the writer chooses anything: the paper background, no sound and no goal.
 * The same as the core's Ambience.Default; it is only used until app.start answers.
 */
export const DEFAULT_AMBIENCE: Ambience = {
  background: "builtin:parchment",
  typing: { sound: "typewriter", volume: 0.6, muted: true },
  ambients: [],
  ambientVolume: 0.6,
  ambientMuted: false,
  dimOthers: false,
  goal: { kind: "none" },
};

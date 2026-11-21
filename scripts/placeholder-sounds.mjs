// Generates the placeholder typing sounds used until the CC0 recordings arrive (block 12 of
// feature 003). They are synthesised with ffmpeg: no recording, no licence. Run it once with
// ffmpeg on the PATH: `node scripts/placeholder-sounds.mjs`.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(
  import.meta.dirname,
  "..",
  "src",
  "ui",
  "public",
  "sounds",
  "typing",
);

/** A short burst of filtered noise that dies away: one keystroke. */
const burst = (seconds, colour, filters, amplitude) =>
  `anoisesrc=d=${seconds}:c=${colour}:a=${amplitude}:seed=SEED,${filters},afade=t=in:d=0.002,afade=t=out:st=0.004:d=${seconds - 0.004}`;

const sounds = {
  typewriter: {
    key: (seed) =>
      burst(
        0.06,
        "white",
        `highpass=f=900,lowpass=f=5200,volume=${1 + (seed % 3) * 0.15}`,
        0.9,
      ).replace("SEED", seed),
    enter: () =>
      burst(
        0.45,
        "brown",
        "highpass=f=300,lowpass=f=2500,tremolo=f=28:d=0.7",
        0.9,
      ).replace("SEED", 7),
    backspace: () =>
      burst(0.05, "white", "highpass=f=600,lowpass=f=3000", 0.7).replace(
        "SEED",
        9,
      ),
    bell: () => "sine=f=2093:d=0.9,afade=t=out:st=0.02:d=0.88,volume=0.5",
  },
  mechanical: {
    key: (seed) =>
      burst(
        0.035,
        "white",
        `bandpass=f=${2600 + seed * 180}:w=1600,volume=1.3`,
        0.9,
      ).replace("SEED", seed),
    enter: () =>
      burst(0.05, "white", "bandpass=f=1800:w=1400,volume=1.5", 0.9).replace(
        "SEED",
        7,
      ),
    backspace: () =>
      burst(0.035, "white", "bandpass=f=2200:w=1400,volume=1.2", 0.9).replace(
        "SEED",
        9,
      ),
  },
  quill: {
    key: (seed) =>
      burst(
        0.12,
        "pink",
        `highpass=f=${3500 + seed * 250},volume=0.5`,
        0.6,
      ).replace("SEED", seed),
    enter: () =>
      burst(0.22, "pink", "highpass=f=3000,volume=0.5", 0.6).replace("SEED", 7),
    backspace: () =>
      burst(0.1, "pink", "highpass=f=2800,volume=0.4", 0.6).replace("SEED", 9),
  },
};

const encode = (source, file) =>
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    source,
    "-ac",
    "1",
    "-c:a",
    "libopus",
    "-b:a",
    "48k",
    file,
  ]);

for (const [name, kinds] of Object.entries(sounds)) {
  const folder = join(root, name);
  mkdirSync(folder, { recursive: true });
  for (let seed = 1; seed <= 4; seed++)
    encode(kinds.key(seed), join(folder, `key-${seed}.ogg`));
  encode(kinds.enter(), join(folder, "enter.ogg"));
  encode(kinds.backspace(), join(folder, "backspace.ogg"));
  if (kinds.bell) encode(kinds.bell(), join(folder, "bell.ogg"));
}
console.log("placeholder sounds in", root);

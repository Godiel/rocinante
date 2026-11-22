// Generates the placeholder café ambience, used until a CC0 café recording is downloaded and
// turned into the real one by scripts/ambience.mjs. Synthesised with ffmpeg: no recording, no
// licence. Run it with ffmpeg on the PATH: `node scripts/placeholder-sounds.mjs`.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const folder = resolve(
  import.meta.dirname,
  "..",
  "src",
  "ui",
  "public",
  "sounds",
  "ambient",
);
mkdirSync(folder, { recursive: true });
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "anoisesrc=d=20:c=brown:a=0.5:seed=13,bandpass=f=500:w=600,tremolo=f=0.7:d=0.3,volume=1.6",
  "-ac",
  "1",
  "-c:a",
  "libopus",
  "-b:a",
  "48k",
  join(folder, "cafe.ogg"),
]);
console.log("placeholder café in", folder);

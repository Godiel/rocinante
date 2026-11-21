// Turns the CC0 / public-domain originals into the sounds and images the app carries.
//
//   node scripts/ambience.mjs <folder with the originals>
//
// The originals are not kept in the repository: only what this script makes from them, under
// src/ui/public. The folder is laid out as they were downloaded (see CREDITS in catalog.ts):
//
//   typewriter1.wav … typewriter8.wav        OpenGameArt "Typewriter sounds"
//   keyboard/Single Keys/keypress-NNN.wav    OpenGameArt "Keyboard Soundpack #1"
//   pencil/flac/pencil_write.flac, …erase…   OpenGameArt "Pencil Sounds"
//   rain/3.ogg                               OpenGameArt "Rain (loopable)"
//   fire.wav                                 OpenGameArt "Fireplace Sound loop"
//   birds-and-wind.ogg                       OpenGameArt "Birds and Wind - Ambient"
//   cafe.wav                                 Freesound (optional until it is downloaded)
//   el-pardo.jpg, torrelodones.jpg, fuenfria.jpg   Wikimedia Commons, Beruete (optional)
//
// Keystrokes are cut out of the recordings by their attack: the energy of the sound is followed
// in 5 ms frames, and each jump starts a stroke. Each stroke is faded at its ends, levelled and
// encoded as Opus. Ambients are levelled to the same loudness and encoded as stereo Opus.
// Needs ffmpeg on the PATH.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("usage: node scripts/ambience.mjs <folder with the originals>");
  process.exit(2);
}
const at = (...parts) => join(source, ...parts);
const publicFolder = resolve(import.meta.dirname, "..", "src", "ui", "public");
const RATE = 48000;

const ffmpeg = (args, input) =>
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], {
    input,
    maxBuffer: 1 << 30,
  });

/** The file as mono 32-bit float samples at 48 kHz. */
function samples(file) {
  const bytes = ffmpeg([
    "-i",
    file,
    "-ac",
    "1",
    "-ar",
    String(RATE),
    "-f",
    "f32le",
    "-",
  ]);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** Where each stroke starts, in samples: a frame much louder than the frames just before it. */
function onsets(pcm, { frameMs = 5, jump = 4, floor = 0.02, gapMs = 70 } = {}) {
  const frame = Math.round((RATE * frameMs) / 1000);
  const energy = [];
  for (let start = 0; start + frame <= pcm.length; start += frame) {
    let sum = 0;
    for (let i = start; i < start + frame; i++) sum += pcm[i] * pcm[i];
    energy.push(Math.sqrt(sum / frame));
  }
  const found = [];
  let last = -Infinity;
  for (let i = 2; i < energy.length; i++) {
    const before = Math.max(energy[i - 1], energy[i - 2], 1e-4);
    if (
      energy[i] > floor &&
      energy[i] > before * jump &&
      (i - last) * frameMs > gapMs
    ) {
      found.push(i * frame);
      last = i;
    }
  }
  return found;
}

/** The loudest point of a stretch, for choosing the clearest strokes. */
function peak(pcm, from, length) {
  let top = 0;
  for (let i = from; i < Math.min(pcm.length, from + length); i++)
    top = Math.max(top, Math.abs(pcm[i]));
  return top;
}

/** Encodes a stretch of samples as a levelled, faded mono Opus file. */
function stroke(pcm, from, ms, file, { gainDb = 0 } = {}) {
  const length = Math.round((RATE * ms) / 1000);
  const start = Math.max(0, from - Math.round(RATE * 0.004));
  const piece = pcm.slice(start, start + length);
  const seconds = piece.length / RATE;
  ffmpeg(
    [
      "-f",
      "f32le",
      "-ar",
      String(RATE),
      "-ac",
      "1",
      "-i",
      "-",
      "-af",
      `afade=t=in:d=0.002,afade=t=out:st=${Math.max(0, seconds - 0.04)}:d=0.04,` +
        `loudnorm=I=-20:TP=-2:LRA=7,volume=${gainDb}dB`,
      "-ar",
      String(RATE),
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      file,
    ],
    Buffer.from(piece.buffer),
  );
}

/** The clearest strokes of some recordings: loud, and not cut short by the next one. */
function bestStrokes(files, count, ms) {
  const candidates = [];
  for (const file of files) {
    const pcm = samples(file);
    const starts = onsets(pcm);
    starts.forEach((start, index) => {
      const room = (starts[index + 1] ?? pcm.length) - start;
      if (room >= (RATE * ms) / 1000)
        candidates.push({
          pcm,
          start,
          loudness: peak(pcm, start, RATE * 0.03),
        });
    });
  }
  candidates.sort((a, b) => b.loudness - a.loudness);
  if (candidates.length < count)
    throw new Error(
      `only ${candidates.length} clean strokes in ${files.join(", ")}`,
    );
  // The loudest ones can clip; the next ones sound most alike.
  return candidates.slice(1, count + 1);
}

function typing(name, keys, { enter, backspace, ms, gainDb = 0 }) {
  const folder = join(publicFolder, "sounds", "typing", name);
  mkdirSync(folder, { recursive: true });
  keys.forEach(({ pcm, start }, index) =>
    stroke(pcm, start, ms, join(folder, `key-${index + 1}.ogg`), { gainDb }),
  );
  if (enter)
    stroke(
      enter.pcm,
      enter.start,
      enter.ms ?? ms * 2,
      join(folder, "enter.ogg"),
      { gainDb },
    );
  if (backspace)
    stroke(backspace.pcm, backspace.start, ms, join(folder, "backspace.ogg"), {
      gainDb: gainDb - 3,
    });
}

/**
 * The carriage return, made of the typewriter's own strokes: the ratchet of the platen as a quick
 * run of softer clicks, then the carriage hitting home.
 */
function carriageReturn(strokes, file) {
  const length = Math.round(RATE * 0.55);
  const out = new Float32Array(length);
  const add = ({ pcm, start }, at, gain, ms) => {
    const piece = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < piece && at + i < length; i++) {
      const fade = Math.min(1, (piece - i) / (RATE * 0.02));
      out[at + i] += (pcm[start + i] ?? 0) * gain * fade;
    }
  };
  for (let click = 0; click < 7; click++) {
    add(
      strokes[click % strokes.length],
      Math.round(RATE * (0.03 + click * 0.045)),
      0.35,
      40,
    );
  }
  add(strokes[0], Math.round(RATE * 0.38), 1, 150);
  stroke(out, 0, 550, file);
}

/** The bell of the typewriter: a bright struck tone that rings out. Synthesised, as none was recorded. */
function bell(file) {
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=f=2093:d=1.2",
    "-f",
    "lavfi",
    "-i",
    "sine=f=5274:d=1.2",
    "-filter_complex",
    "[0][1]amix=inputs=2:weights=1 0.35,afade=t=in:d=0.002,afade=t=out:st=0.01:d=1.15:curve=exp,volume=6dB",
    "-ar",
    String(RATE),
    "-ac",
    "1",
    "-c:a",
    "libopus",
    "-b:a",
    "64k",
    file,
  ]);
}

/** A looping ambient: levelled to the same loudness as the others, stereo Opus, at most two minutes. */
function ambient(name, file, { seconds = 120 } = {}) {
  const folder = join(publicFolder, "sounds", "ambient");
  mkdirSync(folder, { recursive: true });
  ffmpeg([
    "-i",
    file,
    "-t",
    String(seconds),
    "-af",
    "loudnorm=I=-26:TP=-3:LRA=11",
    "-ar",
    String(RATE),
    "-ac",
    "2",
    "-c:a",
    "libopus",
    "-b:a",
    "80k",
    join(folder, `${name}.ogg`),
  ]);
}

/** A background picture: at most 2560 px wide, as WebP. */
function picture(name, file) {
  const folder = join(publicFolder, "backgrounds");
  mkdirSync(folder, { recursive: true });
  ffmpeg([
    "-i",
    file,
    "-vf",
    "scale='min(2560,iw)':-2",
    "-c:v",
    "libwebp",
    "-quality",
    "80",
    join(folder, `${name}.webp`),
  ]);
}

// Typewriter: real strokes; the carriage return is made of them, the bell is synthesised.
const typewriterFiles = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
  at(`typewriter${n}.wav`),
);
const typewriter = bestStrokes(typewriterFiles, 5, 120);
typing("typewriter", typewriter.slice(0, 4), {
  backspace: typewriter[4],
  ms: 120,
});
carriageReturn(
  typewriter,
  join(publicFolder, "sounds", "typing", "typewriter", "enter.ogg"),
);
bell(join(publicFolder, "sounds", "typing", "typewriter", "bell.ogg"));

// Mechanical keyboard: one recorded keystroke per file, already clean.
const keypress = (n) => {
  const pcm = samples(
    at("keyboard", "Single Keys", `keypress-${String(n).padStart(3, "0")}.wav`),
  );
  return { pcm, start: onsets(pcm)[0] ?? 0 };
};
typing("mechanical", [3, 9, 15, 22].map(keypress), {
  enter: { ...keypress(30), ms: 160 },
  backspace: keypress(27),
  ms: 110,
});

// Pencil on paper: short strokes out of one long line of writing, and the eraser.
const pencil = samples(at("pencil", "flac", "pencil_write.flac"));
const pencilStrokes = [0.1, 0.35, 0.62, 0.9].map((seconds) => ({
  pcm: pencil,
  start: Math.round(seconds * RATE),
}));
const eraser = samples(at("pencil", "flac", "pencil_erase.flac"));
typing("quill", pencilStrokes, {
  enter: { pcm: pencil, start: 0, ms: 380 },
  backspace: { pcm: eraser, start: onsets(eraser)[0] ?? 0 },
  ms: 130,
  // A pencil is a continuous scratch: as loud at its peak as a key, it sounds louder.
  gainDb: -6,
});

ambient("rain", at("rain", "3.ogg"));
ambient("fire", at("fire.wav"));
ambient("field", at("birds-and-wind.ogg"));
if (existsSync(at("cafe.wav")))
  ambient("cafe", at("cafe.wav"), { seconds: 100 });
else console.warn("cafe.wav not there: the café keeps its placeholder");

for (const [name, file] of [
  ["el-pardo", "el-pardo.jpg"],
  ["torrelodones", "torrelodones.jpg"],
  ["fuenfria", "fuenfria.jpg"],
]) {
  if (existsSync(at(file))) picture(name, at(file));
  else console.warn(`${file} not there yet`);
}

console.log("done");

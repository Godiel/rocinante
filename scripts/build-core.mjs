// Publishes the .NET core as a self-contained executable and places it where
// Tauri expects sidecars: src/host/binaries/rocinante-core-<target-triple>[.exe]
//
// The target is the one Tauri is building for (TAURI_ENV_TARGET_TRIPLE, set while it runs
// beforeBuildCommand), else the one given with --target, else this computer's. For a universal
// macOS app both architectures are published and joined into one file with lipo.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const RUNTIMES = {
  "x86_64-pc-windows-msvc": "win-x64",
  "aarch64-pc-windows-msvc": "win-arm64",
  "x86_64-apple-darwin": "osx-x64",
  "aarch64-apple-darwin": "osx-arm64",
  "x86_64-unknown-linux-gnu": "linux-x64",
  "aarch64-unknown-linux-gnu": "linux-arm64",
};

const UNIVERSAL = "universal-apple-darwin";

const root = join(import.meta.dirname, "..");
const binaries = join(root, "src", "host", "binaries");

function target() {
  const flag = process.argv.indexOf("--target");
  if (flag >= 0 && process.argv[flag + 1]) return process.argv[flag + 1];
  if (process.env.TAURI_ENV_TARGET_TRIPLE) return process.env.TAURI_ENV_TARGET_TRIPLE;
  return execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
}

/** Publishes the core for one runtime and returns the path of its executable. */
function publish(runtime, extension) {
  const publishDir = join(root, "src", "core", "publish", runtime);
  execFileSync(
    "dotnet",
    [
      "publish",
      join(root, "src", "core", "Rocinante.Sidecar"),
      "--configuration", "Release",
      "--runtime", runtime,
      "--self-contained",
      "-p:PublishSingleFile=true",
      // SQLite ships a native library; it must travel inside the single file.
      "-p:IncludeNativeLibrariesForSelfExtract=true",
      // Drops unused framework code to keep the installer small.
      "-p:PublishTrimmed=true",
      "--output", publishDir,
    ],
    { stdio: "inherit" },
  );
  return join(publishDir, `Rocinante.Sidecar${extension}`);
}

const triple = target();
mkdirSync(binaries, { recursive: true });

if (triple === UNIVERSAL) {
  const intel = publish(RUNTIMES["x86_64-apple-darwin"], "");
  const apple = publish(RUNTIMES["aarch64-apple-darwin"], "");
  // Tauri builds each architecture on its own, and each asks for its own core, before joining them.
  copyFileSync(intel, join(binaries, "rocinante-core-x86_64-apple-darwin"));
  copyFileSync(apple, join(binaries, "rocinante-core-aarch64-apple-darwin"));
  execFileSync(
    "lipo",
    ["-create", "-output", join(binaries, `rocinante-core-${UNIVERSAL}`), intel, apple],
    { stdio: "inherit" },
  );
} else {
  const runtime = RUNTIMES[triple];
  if (!runtime) {
    throw new Error(`Unsupported target triple: ${triple}`);
  }
  const extension = triple.includes("windows") ? ".exe" : "";
  copyFileSync(publish(runtime, extension), join(binaries, `rocinante-core-${triple}${extension}`));
}

console.log(`core sidecar ready for ${triple}`);

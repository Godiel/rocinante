// Publishes the .NET core as a self-contained executable and places it where
// Tauri expects sidecars: src/host/binaries/rocinante-core-<target-triple>[.exe]
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

const triple = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
const runtime = RUNTIMES[triple];
if (!runtime) {
  throw new Error(`Unsupported target triple: ${triple}`);
}

const root = join(import.meta.dirname, "..");
const publishDir = join(root, "src", "core", "publish", runtime);
const extension = triple.includes("windows") ? ".exe" : "";

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

const binaries = join(root, "src", "host", "binaries");
mkdirSync(binaries, { recursive: true });
copyFileSync(
  join(publishDir, `Rocinante.Sidecar${extension}`),
  join(binaries, `rocinante-core-${triple}${extension}`),
);
console.log(`core sidecar ready for ${triple}`);

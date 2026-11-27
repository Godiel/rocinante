// The version of Rocinante, in one place for the writer and in every file that needs it.
// Usage: node scripts/version.mjs <x.y.z>   writes it everywhere
//        node scripts/version.mjs --check   fails if the files do not agree (used in CI)
//        node scripts/version.mjs           prints it
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

/** Each file that carries the version: how to read it and how to write it. */
const FILES = [
  {
    path: "src/host/tauri.conf.json",
    pattern: /("version":\s*")([^"]+)(")/,
  },
  { path: "package.json", pattern: /("version":\s*")([^"]+)(")/ },
  { path: "src/ui/package.json", pattern: /("version":\s*")([^"]+)(")/ },
  { path: "tests/e2e/package.json", pattern: /("version":\s*")([^"]+)(")/ },
  {
    path: "src/host/Cargo.toml",
    pattern: /(\[package\][^[]*?\nversion = ")([^"]+)(")/,
  },
  {
    path: "src/host/Cargo.lock",
    pattern: /(name = "rocinante-host"\nversion = ")([^"]+)(")/,
  },
  {
    path: "src/core/Directory.Build.props",
    pattern: /(<Version>)([^<]+)(<\/Version>)/,
  },
];

/** The npm lock file carries the version of the work and of its workspaces. */
const LOCK = "package-lock.json";
const LOCKED = ["", "src/ui", "tests/e2e"];

function lock() {
  return JSON.parse(readFileSync(join(root, LOCK), "utf8"));
}

const read = (file) =>
  readFileSync(join(root, file.path), "utf8").replace(/\r\n/g, "\n");

function versionOf(file) {
  const match = read(file).match(file.pattern);
  if (!match)
    throw new Error(`${file.path} has no version where it is expected.`);
  return match[2];
}

const argument = process.argv[2];

if (argument === "--check") {
  const locked = lock();
  const versions = [
    ...FILES.map((file) => [file.path, versionOf(file)]),
    [LOCK, locked.version],
    ...LOCKED.map((name) => [
      `${LOCK} (${name || "raíz"})`,
      locked.packages[name]?.version,
    ]),
  ];
  const first = versions[0][1];
  const different = versions.filter(([, version]) => version !== first);
  if (different.length > 0) {
    for (const [path, version] of versions)
      console.error(`${version}  ${path}`);
    throw new Error(
      "The version is not the same everywhere: run node scripts/version.mjs <x.y.z>.",
    );
  }
  console.log(`version ${first} everywhere`);
} else if (argument) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(argument)) {
    throw new Error(`Not a version: ${argument}. Write it as 1.2.3.`);
  }
  for (const file of FILES) {
    const text = read(file);
    if (!file.pattern.test(text))
      throw new Error(`${file.path} has no version where it is expected.`);
    writeFileSync(
      join(root, file.path),
      text.replace(file.pattern, `$1${argument}$3`),
    );
  }
  const locked = lock();
  locked.version = argument;
  for (const name of LOCKED) locked.packages[name].version = argument;
  writeFileSync(join(root, LOCK), `${JSON.stringify(locked, null, 2)}\n`);
  console.log(`version ${argument} written in ${FILES.length + 1} files`);
} else {
  console.log(versionOf(FILES[0]));
}

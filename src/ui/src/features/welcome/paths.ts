// Paths shown and proposed on the welcome screen. The core works with whatever path it gets;
// these only decide what to suggest and how to show it.

const EXTENSION = ".rocinante";
const FORBIDDEN = /[<>:"/\\|?*]/g; // characters no file system accepts in a name
const FALLBACK = "Sin título";

/** A file name for a project: its title without characters file systems refuse. */
export function projectFileName(title: string): string {
  const printable = [...title].filter((character) => character.charCodeAt(0) >= 32).join("");
  const name = printable
    .replace(FORBIDDEN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, ""); // Windows refuses names ending in a dot or a space
  return `${name || FALLBACK}${EXTENSION}`;
}

/** Where a new project would be saved: the chosen folder and a name from its title. */
export function proposedPath(folder: string, title: string): string {
  const separator = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
  const base = folder.endsWith(separator) ? folder.slice(0, -1) : folder;
  return `${base}${separator}${projectFileName(title)}`;
}

/** The folder of a path, as the writer would recognise it. */
export function folderOf(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : path;
}

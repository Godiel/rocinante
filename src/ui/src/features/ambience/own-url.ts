import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Where the page reads one of the writer's own images or sounds: the host's ambience:// protocol,
 * which serves the copies the core keeps, by their name, and nothing else.
 */
export function ambienceUrl(file: string): string {
  return convertFileSrc(file.split(/[\\/]/).pop() ?? "", "ambience");
}

/**
 * Places that keep their own keys, such as the description of a ficha: the shortcuts of the work (Ctrl+S,
 * F5, F6, F11, the index…) leave them alone, so what the writer types there never acts on the text.
 */
export function keepsItsOwnKeys(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-own-keys]") !== null;
}

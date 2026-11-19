/**
 * Text typed in the last moments waits a little before it is saved. Anything that is about to
 * take the document away (switching to another one, sending it to the trash, closing the
 * project) first asks for that text to be saved now.
 */
type Flush = () => Promise<void>;

const flushes = new Set<Flush>();

/** Registers how an open editor saves what is pending. Returns the way to unregister it. */
export function registerPendingSave(flush: Flush): () => void {
  flushes.add(flush);
  return () => flushes.delete(flush);
}

/** Saves now whatever every open editor has pending. */
export async function savePendingNow(): Promise<void> {
  await Promise.all([...flushes].map((flush) => flush()));
}

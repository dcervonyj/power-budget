export const RELOAD_FLAG_KEY = 'pb_chunk_reload';
/** A second failure within this window after a reload is not a stale deploy; stop looping. */
export const RELOAD_WINDOW_MS = 10_000;

export interface StaleChunkTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  location: { reload(): void };
  now(): number;
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
}

/**
 * After a deploy an open tab still asks for old chunk hashes. Reload once to pick up the new
 * build; a failure right after that reload is left to the error boundary, so there is never a loop.
 */
export function reloadOnStaleChunk(target: StaleChunkTarget): void {
  target.addEventListener('vite:preloadError', (event) => {
    const now = target.now();
    const last = Number(target.sessionStorage.getItem(RELOAD_FLAG_KEY));
    if (now - last < RELOAD_WINDOW_MS) {
      return;
    }
    event.preventDefault();
    target.sessionStorage.setItem(RELOAD_FLAG_KEY, String(now));
    target.location.reload();
  });
}

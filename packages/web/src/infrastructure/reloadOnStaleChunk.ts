export const RELOAD_FLAG_KEY = 'pb_chunk_reload';
export const RELOAD_COOLDOWN_MS = 30_000;

export interface StaleChunkTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  location: { reload(): void };
  /** May throw (storage disabled or blocked); the guard treats that as "cannot persist". */
  sessionStorage(): Pick<Storage, 'getItem' | 'setItem'>;
  now(): number;
}

/**
 * Reload guard, one rule: the time of the last automatic reload is kept in sessionStorage,
 * whatever the build, and a vite:preloadError triggers a reload only if no reload happened in
 * the last RELOAD_COOLDOWN_MS.
 *  (a) A failure that survives a reload (same or new build) arrives inside the cooldown, so it
 *      is left to the error boundary: at most one automatic reload per failure, never a loop.
 *  (b) A later deploy in a long-lived tab fails after the cooldown and reloads again.
 *  (c) Storage that is unavailable or throws is caught: without a persisted guard we do not
 *      reload (a loop could not be prevented) and the error goes to the boundary. Nothing
 *      here touches storage at start-up, so the app always boots.
 */
export function reloadOnStaleChunk(target: StaleChunkTarget): void {
  target.addEventListener('vite:preloadError', (event) => {
    const now = target.now();
    if (!claimReload(target, now)) {
      return;
    }
    event.preventDefault();
    target.location.reload();
  });
}

function claimReload(target: StaleChunkTarget, now: number): boolean {
  try {
    const storage = target.sessionStorage();
    const last = Number(storage.getItem(RELOAD_FLAG_KEY));
    if (now - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    storage.setItem(RELOAD_FLAG_KEY, String(now));

    return true;
  } catch {
    return false;
  }
}

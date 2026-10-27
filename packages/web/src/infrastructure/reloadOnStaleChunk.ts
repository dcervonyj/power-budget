export const RELOAD_FLAG_KEY = 'pb_chunk_reload';

/** A reloaded page that stays error free this long counts as recovered and clears the guard. */
export const RECOVERY_MS = 30_000;

export interface StaleChunkTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  location: { reload(): void };
  sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
  /** Identifies the running build (its hashed entry URL). */
  buildId: string;
}

/**
 * After a deploy an open tab still asks for old chunk hashes. Reload once to pick up the new
 * build. A failure right after that reload is left to the error boundary; once the reloaded page
 * has run error free for RECOVERY_MS the guard is cleared, so a later deploy can recover too.
 */
export function reloadOnStaleChunk(target: StaleChunkTarget): void {
  const reloaded = target.sessionStorage.getItem(RELOAD_FLAG_KEY) === target.buildId;
  const recovery = reloaded ? target.setTimeout(() => clearGuard(target), RECOVERY_MS) : undefined;
  target.addEventListener('vite:preloadError', (event) => {
    if (recovery !== undefined) {
      target.clearTimeout(recovery);
    }
    if (target.sessionStorage.getItem(RELOAD_FLAG_KEY) === target.buildId) {
      return;
    }
    event.preventDefault();
    target.sessionStorage.setItem(RELOAD_FLAG_KEY, target.buildId);
    target.location.reload();
  });
}

function clearGuard(target: StaleChunkTarget): void {
  target.sessionStorage.removeItem(RELOAD_FLAG_KEY);
}

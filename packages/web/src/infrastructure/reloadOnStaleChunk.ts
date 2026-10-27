export const RELOAD_FLAG_KEY = 'pb_chunk_reload';

export interface StaleChunkTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  location: { reload(): void };
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Identifies the running build (its hashed entry URL). */
  buildId: string;
}

/**
 * After a deploy an open tab still asks for old chunk hashes. Reload once to pick up the new
 * build. The build we reloaded from is remembered until a different build runs, so a failure
 * that survives the reload is left to the error boundary however much later it happens.
 */
export function reloadOnStaleChunk(target: StaleChunkTarget): void {
  target.addEventListener('vite:preloadError', (event) => {
    if (target.sessionStorage.getItem(RELOAD_FLAG_KEY) === target.buildId) {
      return;
    }
    event.preventDefault();
    target.sessionStorage.setItem(RELOAD_FLAG_KEY, target.buildId);
    target.location.reload();
  });
}

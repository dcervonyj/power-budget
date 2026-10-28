export const RELOAD_FLAG_KEY = 'pb_chunk_reload';

export type StartupChunk = 'locale' | 'route';
const STARTUP_CHUNKS: readonly StartupChunk[] = ['locale', 'route'];

export interface StaleChunkTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
  location: { reload(): void };
  /** May throw (storage disabled or blocked); the guard treats that as "cannot persist". */
  sessionStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

/**
 * Reload guard, one rule, driven by a recovery signal and no timers:
 *  - When we reload automatically we first set the guard (sessionStorage, no build id).
 *  - While the guard is set, every vite:preloadError goes to the error boundary: no reload,
 *    whatever the build. So a failure that survives a reload (same or new build, however slow
 *    the retry) never causes a second reload: at most one automatic reload per failure.
 *  - The guard is cleared only by a positive signal that chunks load again: ALL startup chunks
 *    loaded after the reload (the locale messages and a lazy route, see lazyChunk and
 *    AppProviders), each reporting through chunkLoaded(). One working chunk is not enough while
 *    another still fails. A later deploy in a long-lived tab then recovers with one more reload.
 *  - Storage is only touched inside try/catch, lazily. If it throws we cannot persist the
 *    guard, so we do not reload (the boundary shows Reload) and the app still starts.
 */
export class StaleChunkRecovery {
  private readonly loaded = new Set<StartupChunk>();

  constructor(private readonly target: StaleChunkTarget) {}

  install(): void {
    this.target.addEventListener('vite:preloadError', (event) => {
      if (!this.claimReload()) {
        return;
      }
      event.preventDefault();
      this.target.location.reload();
    });
  }

  /** A startup chunk loaded fine; once every startup chunk has, the reload (if any) recovered. */
  chunkLoaded(chunk: StartupChunk): void {
    this.loaded.add(chunk);
    if (!STARTUP_CHUNKS.every((required) => this.loaded.has(required))) {
      return;
    }
    try {
      const storage = this.target.sessionStorage();
      if (storage.getItem(RELOAD_FLAG_KEY) !== null) {
        storage.removeItem(RELOAD_FLAG_KEY);
      }
    } catch {
      // Storage unavailable: there is no guard to clear.
    }
  }

  private claimReload(): boolean {
    try {
      const storage = this.target.sessionStorage();
      if (storage.getItem(RELOAD_FLAG_KEY) !== null) {
        return false;
      }
      storage.setItem(RELOAD_FLAG_KEY, '1');

      return true;
    } catch {
      return false;
    }
  }
}

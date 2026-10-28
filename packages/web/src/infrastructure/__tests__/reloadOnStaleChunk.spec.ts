import { describe, expect, it, vi } from 'vitest';
import {
  StaleChunkRecovery,
  RELOAD_FLAG_KEY,
  type StaleChunkTarget,
} from '../reloadOnStaleChunk.js';

function setup(overrides: Partial<StaleChunkTarget> = {}) {
  const store = new Map<string, string>();
  const reload = vi.fn();
  let listener: (event: Event) => void = () => undefined;
  const recovery = new StaleChunkRecovery({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    location: { reload },
    sessionStorage: () => ({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    }),
    ...overrides,
  });
  recovery.install();

  return {
    reload,
    store,
    recovery,
    fire: () => listener(new Event('vite:preloadError', { cancelable: true })),
  };
}

const throwingStorage = (): never => {
  throw new Error('SecurityError');
};

describe('StaleChunkRecovery', () => {
  it('reloads on the first preload error and sets the guard', () => {
    const { reload, store, fire } = setup();

    fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_FLAG_KEY)).toBe('1');
  });

  it('persistent failure across a slow retry never reloads twice', () => {
    const { reload, fire } = setup();

    fire();
    vi.useFakeTimers();
    vi.advanceTimersByTime(10 * 60_000);
    fire();
    vi.useRealTimers();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a failure on the new build after an old-build reload does not reload twice', () => {
    const first = setup();
    first.fire();
    const newBuild = setup();
    newBuild.store.set(RELOAD_FLAG_KEY, '1');

    newBuild.fire();

    expect(first.reload).toHaveBeenCalledTimes(1);
    expect(newBuild.reload).not.toHaveBeenCalled();
  });

  it('after a successful chunk load a later stale chunk reloads once', () => {
    const { reload, store, recovery, fire } = setup();
    fire();

    recovery.chunkLoaded('locale');
    recovery.chunkLoaded('route');
    expect(store.has(RELOAD_FLAG_KEY)).toBe(false);
    fire();
    fire();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('keeps the guard while the locale chunk (or the route chunk) has not loaded', () => {
    const { store, recovery, fire } = setup();
    fire();

    recovery.chunkLoaded('route');

    expect(store.get(RELOAD_FLAG_KEY)).toBe('1');
    recovery.chunkLoaded('locale');
    expect(store.has(RELOAD_FLAG_KEY)).toBe(false);
  });

  it('a chunk load without a prior reload leaves storage untouched', () => {
    const { store, recovery } = setup();

    recovery.chunkLoaded('locale');
    recovery.chunkLoaded('route');

    expect(store.size).toBe(0);
  });

  describe('throwing sessionStorage', () => {
    it('does not touch storage while starting, so the app starts', () => {
      const sessionStorage = vi.fn(throwingStorage);

      expect(() => setup({ sessionStorage })).not.toThrow();
      expect(sessionStorage).not.toHaveBeenCalled();
    });

    it('does not reload or throw on a preload error, nor on a chunk load', () => {
      const { reload, recovery, fire } = setup({ sessionStorage: throwingStorage });

      expect(() => fire()).not.toThrow();
      expect(() => recovery.chunkLoaded('route')).not.toThrow();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});

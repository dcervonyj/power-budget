import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk, RELOAD_FLAG_KEY, RECOVERY_MS } from '../reloadOnStaleChunk.js';

function setup(store = new Map<string, string>(), buildId = 'build-a') {
  const reload = vi.fn();
  const timers = new Map<number, { handler: () => void; ms: number }>();
  let listener: (event: Event) => void = () => undefined;
  reloadOnStaleChunk({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    location: { reload },
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    },
    setTimeout: (handler, ms) => {
      timers.set(timers.size + 1, { handler, ms });

      return timers.size;
    },
    clearTimeout: (id) => void timers.delete(id),
    buildId,
  });

  return {
    reload,
    store,
    timers,
    fire: () => listener(new Event('vite:preloadError', { cancelable: true })),
  };
}

describe('reloadOnStaleChunk', () => {
  it('reloads once on the first preload error', () => {
    const { reload, store, fire } = setup();

    fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_FLAG_KEY)).toBe('build-a');
  });

  it('does not reload again for the same build, however late the failure comes', () => {
    const { reload, fire } = setup();

    fire();
    fire();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload after a reload that kept the same build (persistent failure)', () => {
    const store = new Map([[RELOAD_FLAG_KEY, 'build-a']]);
    const { reload, fire } = setup(store, 'build-a');

    fire();

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads again for a later deploy (different build)', () => {
    const store = new Map([[RELOAD_FLAG_KEY, 'build-a']]);
    const { reload, fire } = setup(store, 'build-b');

    fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_FLAG_KEY)).toBe('build-b');
  });

  it('clears the guard once the reloaded page has run error free', () => {
    const store = new Map([[RELOAD_FLAG_KEY, 'build-a']]);
    const { timers } = setup(store, 'build-a');

    expect([...timers.values()].map((timer) => timer.ms)).toEqual([RECOVERY_MS]);
    [...timers.values()][0]?.handler();

    expect(store.has(RELOAD_FLAG_KEY)).toBe(false);
  });

  it('lets a later stale chunk reload the same build after recovery', () => {
    const store = new Map([[RELOAD_FLAG_KEY, 'build-a']]);
    const { reload, timers, fire } = setup(store, 'build-a');

    [...timers.values()][0]?.handler();
    fire();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the guard when the error comes before recovery', () => {
    const store = new Map([[RELOAD_FLAG_KEY, 'build-a']]);
    const { reload, timers, fire } = setup(store, 'build-a');

    fire();

    expect(timers.size).toBe(0);
    expect(reload).not.toHaveBeenCalled();
    expect(store.get(RELOAD_FLAG_KEY)).toBe('build-a');
  });
});

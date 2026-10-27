import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk, RELOAD_FLAG_KEY } from '../reloadOnStaleChunk.js';

function setup(store = new Map<string, string>(), buildId = 'build-a') {
  const reload = vi.fn();
  let listener: (event: Event) => void = () => undefined;
  reloadOnStaleChunk({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    location: { reload },
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    },
    buildId,
  });

  return {
    reload,
    store,
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
});

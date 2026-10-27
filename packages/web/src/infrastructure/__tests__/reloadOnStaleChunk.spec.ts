import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleChunk, RELOAD_FLAG_KEY, RELOAD_WINDOW_MS } from '../reloadOnStaleChunk.js';

function setup() {
  const clock = { value: 1_000_000 };
  const store = new Map<string, string>();
  const reload = vi.fn();
  let listener: (event: Event) => void = () => undefined;
  reloadOnStaleChunk({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    location: { reload },
    now: () => clock.value,
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    },
  });

  return {
    reload,
    store,
    clock,
    fire: () => listener(new Event('vite:preloadError', { cancelable: true })),
  };
}

describe('reloadOnStaleChunk', () => {
  it('reloads once on the first preload error', () => {
    const { reload, store, fire } = setup();

    fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_FLAG_KEY)).toBe('1000000');
  });

  it('does not reload again, leaving the error to the boundary', () => {
    const { reload, fire } = setup();

    fire();
    fire();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads again for a later deploy once the window has passed', () => {
    const { reload, clock, fire } = setup();

    fire();
    clock.value += RELOAD_WINDOW_MS;
    fire();

    expect(reload).toHaveBeenCalledTimes(2);
  });
});

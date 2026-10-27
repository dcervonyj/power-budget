import { describe, expect, it, vi } from 'vitest';
import {
  reloadOnStaleChunk,
  RELOAD_COOLDOWN_MS,
  RELOAD_FLAG_KEY,
  type StaleChunkTarget,
} from '../reloadOnStaleChunk.js';

function setup(overrides: Partial<StaleChunkTarget> = {}) {
  const store = new Map<string, string>();
  const clock = { value: 1_000_000 };
  const reload = vi.fn();
  let listener: (event: Event) => void = () => undefined;
  reloadOnStaleChunk({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
    location: { reload },
    sessionStorage: () => ({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    }),
    now: () => clock.value,
    ...overrides,
  });

  return {
    reload,
    store,
    clock,
    fire: () => listener(new Event('vite:preloadError', { cancelable: true })),
  };
}

describe('reloadOnStaleChunk', () => {
  it('reloads on the first preload error and records the time', () => {
    const { reload, store, fire } = setup();

    fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.get(RELOAD_FLAG_KEY)).toBe('1000000');
  });

  describe('(a) never a loop', () => {
    it('does not reload again for a failure right after the reload', () => {
      const { reload, clock, fire } = setup();

      fire();
      clock.value += RELOAD_COOLDOWN_MS - 1;
      fire();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('holds across a build change: the guard is the stored time, not a build id', () => {
      const { reload, store, clock, fire } = setup();
      store.set(RELOAD_FLAG_KEY, String(clock.value - 1000));

      fire();

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('(b) later deploy in a long-lived tab', () => {
    it('reloads again once the cooldown has passed', () => {
      const { reload, clock, fire } = setup();

      fire();
      clock.value += RELOAD_COOLDOWN_MS;
      fire();

      expect(reload).toHaveBeenCalledTimes(2);
    });
  });

  describe('(c) unavailable sessionStorage', () => {
    it('registers without touching storage, so the app can start', () => {
      const sessionStorage = vi.fn(() => {
        throw new Error('SecurityError');
      });

      expect(() => setup({ sessionStorage })).not.toThrow();
      expect(sessionStorage).not.toHaveBeenCalled();
    });

    it('does not reload or throw when storage throws, leaving the error to the boundary', () => {
      const { reload, fire } = setup({
        sessionStorage: () => {
          throw new Error('SecurityError');
        },
      });

      expect(() => fire()).not.toThrow();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});

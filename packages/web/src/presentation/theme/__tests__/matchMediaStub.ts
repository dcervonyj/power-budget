import { vi } from 'vitest';

type Listener = (event: MediaQueryListEvent) => void;

export interface MediaStub {
  setMatches(query: string, matches: boolean): void;
}

/** Replaces window.matchMedia with a stub whose results the test can flip and that notifies listeners. */
export function stubMatchMedia(initial: Readonly<Record<string, boolean>>): MediaStub {
  const state = new Map<string, boolean>(Object.entries(initial));
  const listeners = new Map<string, Set<Listener>>();

  function listenersOf(query: string): Set<Listener> {
    const existing = listeners.get(query);
    if (existing) {
      return existing;
    }
    const created = new Set<Listener>();
    listeners.set(query, created);

    return created;
  }

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches(): boolean {
      return state.get(query) ?? false;
    },
    media: query,
    addEventListener: (_type: string, listener: Listener) => listenersOf(query).add(listener),
    removeEventListener: (_type: string, listener: Listener) => listenersOf(query).delete(listener),
  }));

  return {
    setMatches(query, matches) {
      state.set(query, matches);
      for (const listener of listenersOf(query)) {
        listener({ matches, media: query } as MediaQueryListEvent);
      }
    },
  };
}

export function stubLocalStorage(
  initial: Readonly<Record<string, string>> = {},
): Map<string, string> {
  const store = new Map<string, string>(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });

  return store;
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionStorageProgressStorage } from './SessionStorageProgressStorage.js';

describe('SessionStorageProgressStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores, reads and removes a value in the tab', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => void values.set(key, value),
      removeItem: (key: string): void => void values.delete(key),
    });
    const storage = new SessionStorageProgressStorage();

    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });

  it('does not throw when the browser refuses storage', () => {
    const refuse = (): never => {
      throw new Error('denied');
    };
    vi.stubGlobal('sessionStorage', { getItem: refuse, setItem: refuse, removeItem: refuse });
    const storage = new SessionStorageProgressStorage();

    expect(() => storage.setItem('k', 'v')).not.toThrow();
    expect(storage.getItem('k')).toBeNull();
    expect(() => storage.removeItem('k')).not.toThrow();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    storage.set(key, value);

    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    storage.delete(key);

    return Promise.resolve();
  }),
}));

import { ExpoSecureStoreTokenStore } from '../ExpoSecureStoreTokenStore.js';

describe('ExpoSecureStoreTokenStore', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('returns null from the sync getters until load() has run, then serves the stored tokens', async () => {
    storage.set('pb_access_token', 'a1');
    storage.set('pb_refresh_token', 'r1');
    const store = new ExpoSecureStoreTokenStore();

    expect(store.getAccessToken()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);

    await store.load();

    expect(store.getAccessToken()).toBe('a1');
    expect(store.getRefreshToken()).toBe('r1');
    expect(store.isAuthenticated()).toBe(true);
  });

  it('caches on setTokens and persists to SecureStore', async () => {
    const store = new ExpoSecureStoreTokenStore();

    await store.setTokens('a2', 'r2');

    expect(store.getAccessToken()).toBe('a2');
    expect(storage.get('pb_access_token')).toBe('a2');
    expect(storage.get('pb_refresh_token')).toBe('r2');
  });

  it('clears the cache and SecureStore on clearTokens', async () => {
    const store = new ExpoSecureStoreTokenStore();
    await store.setTokens('a3', 'r3');

    await store.clearTokens();

    expect(store.getAccessToken()).toBeNull();
    expect(store.getRefreshToken()).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('notifies subscribers on login and logout until they unsubscribe', async () => {
    const store = new ExpoSecureStoreTokenStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.setTokens('a4', 'r4');
    await store.clearTokens();

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await store.setTokens('a5', 'r5');

    expect(listener).toHaveBeenCalledTimes(2);
  });
});

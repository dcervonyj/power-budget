import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_PREFERENCE_KEYS, LocalStorageSessionData } from './LocalStorageSessionData.js';

// Node 25+ hides jsdom's localStorage; use a plain one.
const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length(): number {
    return items.size;
  },
  key: (index: number) => [...items.keys()][index] ?? null,
  getItem: (key: string) => items.get(key) ?? null,
  setItem: (key: string, value: string) => items.set(key, value),
  removeItem: (key: string) => items.delete(key),
  clear: () => items.clear(),
});

describe('LocalStorageSessionData', () => {
  beforeEach(() => {
    items.clear();
  });

  it("removes the user's pb_* keys and keeps the device preferences", () => {
    items.set('pb_access_token', 'a');
    items.set('pb_refresh_token', 'r');
    items.set('pb_base_currency', 'PLN');
    items.set('pb_interesting_currencies', '["USD"]');
    items.set('pb_fx_rates', '{}');
    items.set('pb_theme', 'dark');
    items.set('pb_locale', 'uk');
    items.set('other_app', 'kept');

    new LocalStorageSessionData().resetSession();

    expect([...items.keys()].sort()).toEqual(['other_app', 'pb_locale', 'pb_theme']);
  });

  it('keeps only the theme and the language', () => {
    expect(DEVICE_PREFERENCE_KEYS).toEqual(['pb_theme', 'pb_locale']);
  });
});

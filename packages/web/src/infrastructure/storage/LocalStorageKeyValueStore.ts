import type { KeyValueStore } from '../../application/ports/KeyValueStore.js';

/** The browser's localStorage, read when called so a missing global fails at use, not at import. */
export class LocalStorageKeyValueStore implements KeyValueStore {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}

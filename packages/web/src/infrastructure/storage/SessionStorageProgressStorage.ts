import type { ProgressStorage } from '../../application/ports/ProgressStorage.js';

/**
 * The browser's sessionStorage: kept per tab, across a reload or a full-page redirect. When it is
 * missing or refuses (private mode, quota), reads give null and writes do nothing.
 */
export class SessionStorageProgressStorage implements ProgressStorage {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // The wizard still works for this page; it only cannot survive a reload.
    }
  }

  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing was stored.
    }
  }
}

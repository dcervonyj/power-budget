import type { SessionScoped } from '../../application/auth/ClientSession.js';

const APP_KEY_PREFIX = 'pb_';

/**
 * Device-level preferences that say nothing about the user: the colour theme and the
 * interface language. Every other `pb_*` key (tokens, base and interesting currencies,
 * the FX rate cache) belongs to the signed-in user.
 */
export const DEVICE_PREFERENCE_KEYS: readonly string[] = ['pb_theme', 'pb_locale'];

/** Removes the signed-in user's `pb_*` keys from localStorage when the session ends. */
export class LocalStorageSessionData implements SessionScoped {
  resetSession(): void {
    for (const key of this.userKeys()) {
      localStorage.removeItem(key);
    }
  }

  /** Read first, then removed: removing while walking the indexes would skip keys. */
  private userKeys(): string[] {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key !== null && isUserKey(key)) {
        keys.push(key);
      }
    }

    return keys;
  }
}

function isUserKey(key: string): boolean {
  return key.startsWith(APP_KEY_PREFIX) && !DEVICE_PREFERENCE_KEYS.includes(key);
}

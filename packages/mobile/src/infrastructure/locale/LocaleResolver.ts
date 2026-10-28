import type { SupportedLocale } from '@power-budget/core';
import { isSupportedLocale, toSupportedLocale } from '../../domain/locale.js';

export type { SupportedLocale };

export const LOCALE_STORAGE_KEY = 'pb_locale';

export class LocaleResolver {
  /**
   * Resolves the app locale with the following priority:
   * 1. Stored preference (AsyncStorage) — if it's a supported locale
   * 2. Device language code — if it's a supported locale
   * 3. Fallback to the default locale
   */
  resolve(deviceLanguageCode: string, stored?: string | null): SupportedLocale {
    if (stored && isSupportedLocale(stored)) {
      return stored;
    }

    return toSupportedLocale(deviceLanguageCode);
  }
}

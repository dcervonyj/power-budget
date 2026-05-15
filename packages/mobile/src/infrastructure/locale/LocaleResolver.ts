export type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

const SUPPORTED: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

export const LOCALE_STORAGE_KEY = 'pb_locale';

export class LocaleResolver {
  /**
   * Resolves the app locale with the following priority:
   * 1. Stored preference (AsyncStorage) — if it's a supported locale
   * 2. Device language code — if it's a supported locale
   * 3. Fallback to 'en'
   */
  resolve(deviceLanguageCode: string, stored?: string | null): SupportedLocale {
    if (stored && (SUPPORTED as readonly string[]).includes(stored)) {
      return stored as SupportedLocale;
    }
    const lang = deviceLanguageCode.split('-')[0] ?? 'en';
    return (SUPPORTED as readonly string[]).includes(lang) ? (lang as SupportedLocale) : 'en';
  }
}

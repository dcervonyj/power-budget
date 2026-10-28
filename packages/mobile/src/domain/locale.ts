import type { SupportedLocale } from '@power-budget/core';

/** The locales the app ships messages for; the one list the mobile locale logic reads. */
export const SUPPORTED_APP_LOCALES: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

/** The app locale when the device, the profile or a locale tag gives no supported one. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** The language of a BCP 47 tag ("pl-PL" gives "pl"); the whole tag when it has no region. */
export function languageOf(tag: string): string {
  const dash = tag.indexOf('-');

  return dash === -1 ? tag : tag.slice(0, dash);
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_APP_LOCALES.some((supported) => supported === value);
}

/** The supported app locale for a locale tag ("pl-PL" gives "pl"); English otherwise. */
export function toSupportedLocale(tag: string): SupportedLocale {
  const language = languageOf(tag);

  return isSupportedLocale(language) ? language : DEFAULT_LOCALE;
}

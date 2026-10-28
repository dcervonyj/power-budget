import type { SupportedLocale } from '@power-budget/core';

/** The app locale when the device, the profile or a locale tag gives no supported one. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** The language of a BCP 47 tag ("pl-PL" gives "pl"); the whole tag when it has no region. */
export function languageOf(tag: string): string {
  const dash = tag.indexOf('-');

  return dash === -1 ? tag : tag.slice(0, dash);
}

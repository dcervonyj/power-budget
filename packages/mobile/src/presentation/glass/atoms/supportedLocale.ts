import { DEFAULT_LOCALE, languageOf } from '../../../domain/locale.js';
import type { SupportedLocale } from '@power-budget/core';

const SUPPORTED: readonly SupportedLocale[] = ['en', 'pl', 'uk', 'ru'];

/** The supported app locale for a react-intl locale tag ("pl-PL" gives "pl"); English otherwise. */
export function toSupportedLocale(locale: string): SupportedLocale {
  const language = languageOf(locale);

  return SUPPORTED.find((supported) => supported === language) ?? DEFAULT_LOCALE;
}

import type { SupportedLocale } from '@power-budget/core';

const SUPPORTED: readonly SupportedLocale[] = ['en', 'pl', 'uk', 'ru'];

/** The supported app locale for a react-intl locale tag ("pl-PL" gives "pl"); English otherwise. */
export function toSupportedLocale(locale: string): SupportedLocale {
  const language = locale.split('-')[0] ?? '';

  return SUPPORTED.find((supported) => supported === language) ?? 'en';
}

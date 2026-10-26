import { formatMoney } from '@power-budget/core';
import type { MinorUnitAmount, SupportedLocale } from '@power-budget/core';

const SUPPORTED: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

/** Exact minor units in the locale's money format ("1 234,56 zł"), through core `formatMoney`. */
export function formatLightAmount(money: MinorUnitAmount, locale: string): string {
  return formatMoney(money, toSupportedLocale(locale));
}

function toSupportedLocale(locale: string): SupportedLocale {
  const language = locale.split('-')[0] ?? '';

  return SUPPORTED.find((supported) => supported === language) ?? 'en';
}

import { formatMoney } from '@power-budget/core';
import type { MinorUnitAmount } from '@power-budget/core';
import { toSupportedLocale } from '../atoms/supportedLocale.js';

/** Exact minor units in the locale's money format ("1 234,56 zł"), through core `formatMoney`. */
export function formatLightAmount(money: MinorUnitAmount, locale: string): string {
  return formatMoney(money, toSupportedLocale(locale));
}

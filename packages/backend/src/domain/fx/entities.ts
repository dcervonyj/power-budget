import type { CurrencyCode, FxRate as CoreFxRate } from '@power-budget/core';

export type { FxRateSource } from '@power-budget/core';

/** One stored rate: `1 baseCurrency = rate quoteCurrency`, rate a decimal string. */
export type FxRate = CoreFxRate;

export type NewFxRate = Omit<FxRate, 'id'>;

export interface UserCurrencyPreferences {
  readonly userId: string;
  readonly baseCurrency: CurrencyCode;
  readonly interestingCurrencies: readonly CurrencyCode[];
}

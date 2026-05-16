import type { CurrencyCode, IsoDate, IsoDateTime } from '@power-budget/core';

export type FxRateSource = 'ECB' | 'FRANKFURTER';

export interface FxRate {
  readonly id: string; // `${base}_${quote}_${rateOnDate}`
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  readonly rateMinorUnits: bigint; // rate × 10^6, stored as integer
  readonly rateOnDate: IsoDate;
  readonly source: FxRateSource;
  readonly fetchedAt: IsoDateTime;
}

export interface NewFxRate {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
  readonly rateMinorUnits: bigint;
  readonly rateOnDate: IsoDate;
  readonly source: FxRateSource;
  readonly fetchedAt: IsoDateTime;
}

export interface UserCurrencyPreferences {
  readonly userId: string;
  readonly baseCurrency: CurrencyCode;
  readonly interestingCurrencies: readonly CurrencyCode[];
}

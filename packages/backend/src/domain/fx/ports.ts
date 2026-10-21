import type { CurrencyCode, FxRateTable, IsoDate, UserId } from '@power-budget/core';
import type { FxRate, NewFxRate, UserCurrencyPreferences } from './entities.js';

/**
 * A source of official reference rates. Returns `EUR/x` rows published for
 * exactly `date` (rateDate === date), or an empty list when the source did not
 * publish that day (weekend, holiday).
 */
export interface FxRateProvider {
  fetchForDate(date: IsoDate): Promise<NewFxRate[]>;
}

/** FX rates are global reference data, not household data: no HouseholdScope. */
export interface FxRateRepository {
  /** Inserts rows; a row that already exists for (base, quote, date) is kept. Returns rows inserted. */
  saveBatch(rates: readonly NewFxRate[]): Promise<number>;
  /** Latest rate per pair published on or before asOf and at most maxAgeDays older. */
  getTable(asOf: IsoDate, maxAgeDays: number): Promise<FxRateTable>;
  getRate(base: CurrencyCode, quote: CurrencyCode, date: IsoDate): Promise<FxRate | null>;
  /** Quote currencies already stored for this base and exact date. */
  listQuoteCurrencies(base: CurrencyCode, date: IsoDate): Promise<CurrencyCode[]>;
}

export interface CurrencyPreferencesRepository {
  get(userId: UserId): Promise<UserCurrencyPreferences>;
  set(userId: UserId, prefs: UserCurrencyPreferences): Promise<void>;
}

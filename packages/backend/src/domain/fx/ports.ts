import type { CurrencyCode, FxRateTable, UserId } from '@power-budget/core';
import type { FxRate, NewFxRate, UserCurrencyPreferences } from './entities.js';

export interface FxRateProvider {
  fetchForDate(date: Date): Promise<NewFxRate[]>;
}

export interface FxRateRepository {
  saveBatch(rates: NewFxRate[]): Promise<void>;
  getTable(asOf: Date): Promise<FxRateTable>;
  getRate(base: CurrencyCode, quote: CurrencyCode, asOf: Date): Promise<FxRate | null>;
}

export interface CurrencyPreferencesRepository {
  get(userId: UserId): Promise<UserCurrencyPreferences>;
  set(userId: UserId, prefs: UserCurrencyPreferences): Promise<void>;
}

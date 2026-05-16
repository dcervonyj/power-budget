import type { CurrencyCode } from '@power-budget/core';
import type { FxRateProvider, FxRateRepository, NewFxRate } from '../../domain/index.js';

const FALLBACK_CURRENCIES: readonly CurrencyCode[] = ['UAH', 'RUB'];

export class IngestEcbDailyRatesUseCase {
  constructor(
    private readonly provider: FxRateProvider,
    private readonly fallbackProvider: FxRateProvider,
    private readonly repo: FxRateRepository,
  ) {}

  async execute(date: Date): Promise<void> {
    const existing = await this.repo.getRate('EUR', 'USD', date);
    if (existing !== null) {
      return;
    }

    const ecbRates = await this.provider.fetchForDate(date);
    const fallbackRates = await this.fetchFallbackIfNeeded(ecbRates, date);

    await this.repo.saveBatch([...ecbRates, ...fallbackRates]);
  }

  private async fetchFallbackIfNeeded(
    ecbRates: readonly NewFxRate[],
    date: Date,
  ): Promise<NewFxRate[]> {
    const coveredCurrencies = new Set<CurrencyCode>([
      ...ecbRates.map((r) => r.base),
      ...ecbRates.map((r) => r.quote),
    ]);
    const missing = FALLBACK_CURRENCIES.filter((c) => !coveredCurrencies.has(c));

    if (missing.length === 0) {
      return [];
    }

    const allFallback = await this.fallbackProvider.fetchForDate(date);

    return allFallback.filter((r) => missing.includes(r.quote));
  }
}

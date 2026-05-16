import { describe, it, expect, vi } from 'vitest';
import { IngestEcbDailyRatesUseCase } from './IngestEcbDailyRatesUseCase.js';
import type { FxRateProvider, FxRateRepository } from '../../domain/index.js';
import type { NewFxRate } from '../../domain/index.js';
import { IsoDate, IsoDateTime } from '@power-budget/core';

const INGEST_DATE = new Date('2026-01-15T00:00:00.000Z');
const RATE_ON_DATE = IsoDate.of('2026-01-15');
const FETCHED_AT = IsoDateTime.of('2026-01-15T00:00:00.000Z');

function makeRate(base: string, quote: string): NewFxRate {
  return {
    base: base as NewFxRate['base'],
    quote: quote as NewFxRate['quote'],
    rateMinorUnits: 1_000_000n,
    rateOnDate: RATE_ON_DATE,
    source: 'ECB',
    fetchedAt: FETCHED_AT,
  };
}

const ECB_RATES: NewFxRate[] = [
  makeRate('EUR', 'USD'),
  makeRate('EUR', 'PLN'),
  makeRate('EUR', 'GBP'),
  makeRate('USD', 'EUR'),
  makeRate('USD', 'PLN'),
  makeRate('USD', 'GBP'),
  makeRate('PLN', 'EUR'),
  makeRate('PLN', 'USD'),
  makeRate('PLN', 'GBP'),
  makeRate('GBP', 'EUR'),
  makeRate('GBP', 'USD'),
  makeRate('GBP', 'PLN'),
];

const UAH_FALLBACK_RATE: NewFxRate = {
  base: 'EUR',
  quote: 'UAH',
  rateMinorUnits: 44_871_200n,
  rateOnDate: RATE_ON_DATE,
  source: 'FRANKFURTER',
  fetchedAt: FETCHED_AT,
};

function makeProvider(rates: NewFxRate[]): FxRateProvider {
  return { fetchForDate: vi.fn().mockResolvedValue(rates) };
}

function makeRepo(
  existingRate: ReturnType<FxRateRepository['getRate']> extends Promise<infer T> ? T : never = null,
): FxRateRepository {
  return {
    saveBatch: vi.fn().mockResolvedValue(undefined),
    getTable: vi.fn().mockResolvedValue(new Map()),
    getRate: vi.fn().mockResolvedValue(existingRate),
  };
}

describe('IngestEcbDailyRatesUseCase', () => {
  describe('happy path', () => {
    it('fetches ECB rates and saves them when no existing rates', async () => {
      const provider = makeProvider(ECB_RATES);
      const fallback = makeProvider([UAH_FALLBACK_RATE]);
      const repo = makeRepo(null);
      const useCase = new IngestEcbDailyRatesUseCase(provider, fallback, repo);

      await useCase.execute(INGEST_DATE);

      expect(provider.fetchForDate).toHaveBeenCalledWith(INGEST_DATE);
      expect(repo.saveBatch).toHaveBeenCalledWith(expect.arrayContaining([...ECB_RATES]));
    });

    it('supplements with fallback for UAH when ECB does not cover it', async () => {
      const provider = makeProvider(ECB_RATES); // no UAH in ECB rates
      const fallback = makeProvider([UAH_FALLBACK_RATE]);
      const repo = makeRepo(null);
      const useCase = new IngestEcbDailyRatesUseCase(provider, fallback, repo);

      await useCase.execute(INGEST_DATE);

      expect(fallback.fetchForDate).toHaveBeenCalledWith(INGEST_DATE);
      const savedRates = vi.mocked(repo.saveBatch).mock.calls[0]?.[0];
      expect(savedRates).toContainEqual(UAH_FALLBACK_RATE);
    });

    it('does not call fallback when ECB already covers UAH and RUB', async () => {
      const ecbWithUahAndRub: NewFxRate[] = [
        ...ECB_RATES,
        makeRate('EUR', 'UAH'),
        makeRate('UAH', 'EUR'),
        makeRate('EUR', 'RUB'),
        makeRate('RUB', 'EUR'),
      ];
      const provider = makeProvider(ecbWithUahAndRub);
      const fallback = makeProvider([UAH_FALLBACK_RATE]);
      const repo = makeRepo(null);
      const useCase = new IngestEcbDailyRatesUseCase(provider, fallback, repo);

      await useCase.execute(INGEST_DATE);

      expect(fallback.fetchForDate).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('skips fetch and save when EUR/USD rate already exists for the date', async () => {
      const provider = makeProvider(ECB_RATES);
      const fallback = makeProvider([]);
      const existingRate = {
        id: 'EUR_USD_2026-01-15',
        base: 'EUR' as const,
        quote: 'USD' as const,
        rateMinorUnits: 1_084_200n,
        rateOnDate: RATE_ON_DATE,
        source: 'ECB' as const,
        fetchedAt: FETCHED_AT,
      };
      const repo = makeRepo(existingRate);
      const useCase = new IngestEcbDailyRatesUseCase(provider, fallback, repo);

      await useCase.execute(INGEST_DATE);

      expect(provider.fetchForDate).not.toHaveBeenCalled();
      expect(repo.saveBatch).not.toHaveBeenCalled();
    });
  });
});

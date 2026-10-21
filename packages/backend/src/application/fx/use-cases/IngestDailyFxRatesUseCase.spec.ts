import { describe, it, expect, vi } from 'vitest';
import { IsoDate, IsoDateTime } from '@power-budget/core';
import type { CurrencyCode, FxRateSource } from '@power-budget/core';
import { IngestDailyFxRatesUseCase } from './IngestDailyFxRatesUseCase.js';
import type { FxRateProvider, FxRateRepository, NewFxRate } from '../../../domain/fx/index.js';

const DATE = IsoDate.of('2026-10-20');
const FETCHED_AT = IsoDateTime.of('2026-10-20T15:00:00.000Z');

function rate(quote: CurrencyCode, value: string, source: FxRateSource, date = DATE): NewFxRate {
  return {
    baseCurrency: 'EUR',
    quoteCurrency: quote,
    rate: value,
    rateDate: date,
    source,
    fetchedAt: FETCHED_AT,
  };
}

const ECB_ROWS = [
  rate('PLN', '4.3768', 'ecb'),
  rate('USD', '1.1215', 'ecb'),
  rate('GBP', '0.84028', 'ecb'),
];
const NBP_ROWS = [
  rate('PLN', '4.3716', 'nbp'),
  rate('USD', '1.1221027234', 'nbp'),
  rate('GBP', '0.840643809', 'nbp'),
  rate('UAH', '50.5972222222', 'nbp'),
];

function provider(rows: NewFxRate[]): FxRateProvider {
  return { fetchForDate: vi.fn<FxRateProvider['fetchForDate']>().mockResolvedValue(rows) };
}

function failingProvider(message: string): FxRateProvider {
  return {
    fetchForDate: vi.fn<FxRateProvider['fetchForDate']>().mockRejectedValue(new Error(message)),
  };
}

function repo(stored: CurrencyCode[] = []): FxRateRepository {
  return {
    saveBatch: vi
      .fn<FxRateRepository['saveBatch']>()
      .mockImplementation((rows) => Promise.resolve(rows.length)),
    getTable: vi.fn<FxRateRepository['getTable']>(),
    getRate: vi.fn<FxRateRepository['getRate']>(),
    listQuoteCurrencies: vi.fn<FxRateRepository['listQuoteCurrencies']>().mockResolvedValue(stored),
  };
}

describe('IngestDailyFxRatesUseCase', () => {
  it('stores ECB rates and only the UAH row from the fallback', async () => {
    const ecb = provider(ECB_ROWS);
    const nbp = provider(NBP_ROWS);
    const store = repo();

    const result = await new IngestDailyFxRatesUseCase(ecb, nbp, store).execute(DATE);

    expect(ecb.fetchForDate).toHaveBeenCalledWith(DATE);
    expect(nbp.fetchForDate).toHaveBeenCalledWith(DATE);
    expect(store.saveBatch).toHaveBeenCalledWith([
      ...ECB_ROWS,
      rate('UAH', '50.5972222222', 'nbp'),
    ]);
    expect(result).toEqual({
      date: DATE,
      saved: 4,
      alreadyComplete: false,
      missing: [],
      warnings: [],
    });
  });

  it('checks the stored currencies by the exact date and EUR base', async () => {
    const store = repo();

    await new IngestDailyFxRatesUseCase(provider(ECB_ROWS), provider(NBP_ROWS), store).execute(
      DATE,
    );

    expect(store.listQuoteCurrencies).toHaveBeenCalledWith('EUR', DATE);
  });

  it('does nothing when every required currency is already stored for the date', async () => {
    const ecb = provider(ECB_ROWS);
    const nbp = provider(NBP_ROWS);
    const store = repo(['PLN', 'USD', 'GBP', 'UAH', 'CHF']);

    const result = await new IngestDailyFxRatesUseCase(ecb, nbp, store).execute(DATE);

    expect(ecb.fetchForDate).not.toHaveBeenCalled();
    expect(nbp.fetchForDate).not.toHaveBeenCalled();
    expect(store.saveBatch).not.toHaveBeenCalled();
    expect(result.alreadyComplete).toBe(true);
  });

  it('only fills the currencies missing for the date (re-run after a partial day)', async () => {
    const nbp = provider(NBP_ROWS);
    const store = repo(['PLN', 'USD', 'GBP']);

    await new IngestDailyFxRatesUseCase(provider(ECB_ROWS), nbp, store).execute(DATE);

    expect(store.saveBatch).toHaveBeenCalledWith([rate('UAH', '50.5972222222', 'nbp')]);
  });

  it('skips the fallback when the primary covers every required currency', async () => {
    const nbp = provider(NBP_ROWS);
    const ecbWithUah = provider([...ECB_ROWS, rate('UAH', '48.1', 'ecb')]);

    await new IngestDailyFxRatesUseCase(ecbWithUah, nbp, repo()).execute(DATE);

    expect(nbp.fetchForDate).not.toHaveBeenCalled();
  });

  it('falls back to NBP for everything when ECB is down, and reports a warning', async () => {
    const store = repo();

    const result = await new IngestDailyFxRatesUseCase(
      failingProvider('ECB fetch failed with status 503'),
      provider(NBP_ROWS),
      store,
    ).execute(DATE);

    expect(store.saveBatch).toHaveBeenCalledWith(NBP_ROWS);
    expect(result.missing).toEqual([]);
    expect(result.warnings).toEqual([
      'primary FX provider failed for 2026-10-20: ECB fetch failed with status 503',
    ]);
  });

  it('reports the required currencies missing on a day nobody published', async () => {
    const store = repo();

    const result = await new IngestDailyFxRatesUseCase(provider([]), provider([]), store).execute(
      IsoDate.of('2026-10-18'),
    );

    expect(store.saveBatch).toHaveBeenCalledWith([]);
    expect(result).toEqual({
      date: '2026-10-18',
      saved: 0,
      alreadyComplete: false,
      missing: ['PLN', 'USD', 'GBP', 'UAH'],
      warnings: [],
    });
  });

  it('ignores rows for another date or base (a provider must not shift dates)', async () => {
    const store = repo();
    const stray = provider([
      rate('PLN', '4.3713', 'ecb', IsoDate.of('2026-10-19')),
      { ...rate('USD', '1.2', 'ecb'), baseCurrency: 'PLN' },
    ]);

    await new IngestDailyFxRatesUseCase(stray, provider([]), store).execute(DATE);

    expect(store.saveBatch).toHaveBeenCalledWith([]);
  });

  it('records the fallback failure as a warning too', async () => {
    const result = await new IngestDailyFxRatesUseCase(
      provider(ECB_ROWS),
      failingProvider('NBP fetch failed with status 500'),
      repo(),
    ).execute(DATE);

    expect(result.missing).toEqual(['UAH']);
    expect(result.warnings).toEqual([
      'fallback FX provider failed for 2026-10-20: NBP fetch failed with status 500',
    ]);
  });
});

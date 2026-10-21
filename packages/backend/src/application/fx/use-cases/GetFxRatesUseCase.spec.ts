import { describe, it, expect, vi } from 'vitest';
import { FxRateId, IsoDate, IsoDateTime } from '@power-budget/core';
import type { CurrencyCode, FxRate, FxRateTable } from '@power-budget/core';
import { GetFxRatesUseCase } from './GetFxRatesUseCase.js';
import { FxRateUnavailableError } from '../errors.js';
import type { FxRateRepository } from '../../../domain/fx/index.js';

const DATE = IsoDate.of('2026-10-20');

function row(quote: CurrencyCode, value: string): [string, FxRate] {
  return [
    `EUR/${quote}`,
    {
      id: FxRateId.of('01936d3e-8000-7000-a000-000000000001'),
      baseCurrency: 'EUR',
      quoteCurrency: quote,
      rate: value,
      rateDate: DATE,
      source: 'ecb',
      fetchedAt: IsoDateTime.of('2026-10-20T15:00:00.000Z'),
    },
  ];
}

const TABLE: FxRateTable = new Map([
  row('PLN', '4.3768'),
  row('USD', '1.1215'),
  row('GBP', '0.84028'),
  row('UAH', '50.5972222222'),
]);

function repo(table: FxRateTable): FxRateRepository {
  return {
    saveBatch: vi.fn<FxRateRepository['saveBatch']>(),
    getTable: vi.fn<FxRateRepository['getTable']>().mockResolvedValue(table),
    getRate: vi.fn<FxRateRepository['getRate']>(),
    listQuoteCurrencies: vi.fn<FxRateRepository['listQuoteCurrencies']>(),
  };
}

describe('GetFxRatesUseCase', () => {
  it('returns the stored EUR rates verbatim for base EUR', async () => {
    const store = repo(TABLE);

    const result = await new GetFxRatesUseCase(store).execute({ date: DATE, baseCurrency: 'EUR' });

    expect(store.getTable).toHaveBeenCalledWith(DATE, 7);
    expect(result).toEqual({
      date: DATE,
      baseCurrency: 'EUR',
      rates: { PLN: '4.3768', USD: '1.1215', GBP: '0.84028', UAH: '50.5972222222' },
    });
  });

  it('derives inverse and EUR-pivot rates as decimal strings for another base', async () => {
    const result = await new GetFxRatesUseCase(repo(TABLE)).execute({
      date: DATE,
      baseCurrency: 'PLN',
    });

    expect(result.rates).toEqual({
      EUR: '0.2284774264', // 1 / 4.3768
      USD: '0.2562374337', // 1.1215 / 4.3768
      GBP: '0.1919850119', // 0.84028 / 4.3768
      UAH: '11.5603231178', // 50.5972222222 / 4.3768
    });
  });

  it('throws FxRateUnavailableError when nothing is stored within the window', async () => {
    await expect(
      new GetFxRatesUseCase(repo(new Map())).execute({ date: DATE, baseCurrency: 'PLN' }),
    ).rejects.toThrow(FxRateUnavailableError);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { GetFxRateUseCase } from './GetFxRateUseCase.js';
import type { FxRateRepository } from '../../../domain/fx/index.js';
import type { FxRate } from '../../../domain/fx/index.js';
import { FxRateUnavailableError } from '../errors.js';
import { IsoDate, IsoDateTime } from '@power-budget/core';

const RATE_ON_DATE = IsoDate.of('2026-01-13');
const FETCHED_AT = IsoDateTime.of('2026-01-13T06:00:00.000Z');

const SAMPLE_RATE: FxRate = {
  id: 'EUR_USD_2026-01-13',
  base: 'EUR',
  quote: 'USD',
  rateMinorUnits: 1_084_200n,
  rateOnDate: RATE_ON_DATE,
  source: 'ECB',
  fetchedAt: FETCHED_AT,
};

function makeRepo(
  getRate: FxRateRepository['getRate'],
): FxRateRepository {
  return {
    saveBatch: vi.fn(),
    getTable: vi.fn().mockResolvedValue(new Map()),
    getRate,
  };
}

describe('GetFxRateUseCase', () => {
  it('returns rate when found for the requested date', async () => {
    const repo = makeRepo(vi.fn().mockResolvedValue(SAMPLE_RATE));
    const useCase = new GetFxRateUseCase(repo);

    const result = await useCase.execute({
      base: 'EUR',
      quote: 'USD',
      asOf: new Date('2026-01-13T00:00:00.000Z'),
    });

    expect(result).toEqual(SAMPLE_RATE);
    expect(repo.getRate).toHaveBeenCalledTimes(1);
  });

  it('carries forward when rate is missing for requested date but present 3 days prior', async () => {
    const getRate = vi
      .fn()
      .mockResolvedValueOnce(null) // day 0
      .mockResolvedValueOnce(null) // day 1
      .mockResolvedValueOnce(null) // day 2
      .mockResolvedValueOnce(SAMPLE_RATE); // day 3

    const repo = makeRepo(getRate);
    const useCase = new GetFxRateUseCase(repo);

    const asOf = new Date('2026-01-16T00:00:00.000Z');
    const result = await useCase.execute({ base: 'EUR', quote: 'USD', asOf });

    expect(result).toEqual(SAMPLE_RATE);
    expect(repo.getRate).toHaveBeenCalledTimes(4);
  });

  it('returns rate on day 7 (boundary)', async () => {
    const getRate = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(SAMPLE_RATE); // day 7

    const repo = makeRepo(getRate);
    const useCase = new GetFxRateUseCase(repo);

    const asOf = new Date('2026-01-20T00:00:00.000Z');
    const result = await useCase.execute({ base: 'EUR', quote: 'USD', asOf });

    expect(result).toEqual(SAMPLE_RATE);
    expect(repo.getRate).toHaveBeenCalledTimes(8);
  });

  it('throws FxRateUnavailableError when no rate found within 7 days', async () => {
    const getRate = vi.fn().mockResolvedValue(null);
    const repo = makeRepo(getRate);
    const useCase = new GetFxRateUseCase(repo);

    const asOf = new Date('2026-01-20T00:00:00.000Z');

    await expect(
      useCase.execute({ base: 'EUR', quote: 'USD', asOf }),
    ).rejects.toThrow(FxRateUnavailableError);

    // called 8 times: days 0 through 7
    expect(repo.getRate).toHaveBeenCalledTimes(8);
  });

  it('FxRateUnavailableError message includes base, quote, and date', async () => {
    const repo = makeRepo(vi.fn().mockResolvedValue(null));
    const useCase = new GetFxRateUseCase(repo);

    const asOf = new Date('2026-01-20T00:00:00.000Z');

    await expect(
      useCase.execute({ base: 'EUR', quote: 'USD', asOf }),
    ).rejects.toThrow('FX_RATE_UNAVAILABLE: EUR/USD for 2026-01-20');
  });
});

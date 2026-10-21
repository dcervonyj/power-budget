import { describe, it, expect, vi } from 'vitest';
import { IsoDate } from '@power-budget/core';
import { FxCronService } from './FxCronService.js';
import type { FxIngestResult } from '../../../application/fx/use-cases/IngestDailyFxRatesUseCase.js';
import { IngestDailyFxRatesUseCase } from '../../../application/fx/use-cases/IngestDailyFxRatesUseCase.js';
import type { FxRateProvider, FxRateRepository } from '../../../domain/fx/index.js';

function result(date: string): FxIngestResult {
  return { date: IsoDate.of(date), saved: 0, alreadyComplete: true, missing: [], warnings: [] };
}

const NO_PROVIDER: FxRateProvider = { fetchForDate: () => Promise.resolve([]) };
const NO_REPO: FxRateRepository = {
  saveBatch: () => Promise.resolve(0),
  getTable: () => Promise.resolve(new Map()),
  getRate: () => Promise.resolve(null),
  listQuoteCurrencies: () => Promise.resolve([]),
};

function ingestMock() {
  const ingest = new IngestDailyFxRatesUseCase(NO_PROVIDER, NO_PROVIDER, NO_REPO);
  const execute = vi
    .spyOn(ingest, 'execute')
    .mockImplementation((date: IsoDate) => Promise.resolve(result(date)));

  return { ingest, execute };
}

describe('FxCronService', () => {
  it('ingests today and the three previous days, oldest first', async () => {
    const { ingest, execute } = ingestMock();

    await new FxCronService(ingest).runDailyIngest(new Date('2026-10-20T15:00:00.000Z'));

    expect(execute.mock.calls.map(([date]) => date)).toEqual([
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('keeps going when one date fails', async () => {
    const { ingest, execute } = ingestMock();
    execute.mockRejectedValueOnce(new Error('db down'));

    await expect(
      new FxCronService(ingest).runDailyIngest(new Date('2026-10-20T15:00:00.000Z')),
    ).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(4);
  });
});

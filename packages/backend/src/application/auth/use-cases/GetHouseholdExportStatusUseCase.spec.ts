import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { HouseholdId, UserId, HouseholdExportId } from '@power-budget/core';
import type { HouseholdExport, HouseholdExportRepository } from '../../../domain/auth/ports.js';
import { GetHouseholdExportStatusUseCase } from './GetHouseholdExportStatusUseCase.js';

const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000001');
const NOW = new Date('2026-10-22T12:00:00Z');

function makeExport(overrides: Partial<HouseholdExport>): HouseholdExport {
  return {
    id: HouseholdExportId.of('01900000-0000-7000-8000-000000000010'),
    householdId: HOUSEHOLD_ID,
    requestedByUserId: UserId.of('01900000-0000-7000-8000-000000000002'),
    status: 'pending',
    downloadUrl: null,
    expiresAt: null,
    createdAt: new Date('2026-10-22T11:00:00Z'),
    ...overrides,
  };
}

describe('GetHouseholdExportStatusUseCase', () => {
  let exportRepo: ReturnType<typeof mock<HouseholdExportRepository>>;
  let useCase: GetHouseholdExportStatusUseCase;

  beforeEach(() => {
    exportRepo = mock<HouseholdExportRepository>();
    useCase = new GetHouseholdExportStatusUseCase(exportRepo);
  });

  it('returns null when no export was requested', async () => {
    exportRepo.findLatestByHousehold.mockResolvedValue(null);

    expect(await useCase.execute({ householdId: HOUSEHOLD_ID, now: NOW })).toBeNull();
    expect(exportRepo.findLatestByHousehold).toHaveBeenCalledWith(HOUSEHOLD_ID);
  });

  it('returns pending without a url', async () => {
    exportRepo.findLatestByHousehold.mockResolvedValue(makeExport({ status: 'pending' }));

    expect(await useCase.execute({ householdId: HOUSEHOLD_ID, now: NOW })).toEqual({
      status: 'pending',
      url: null,
      expiresAt: null,
    });
  });

  it('returns the url of a ready, unexpired export', async () => {
    const expiresAt = new Date('2026-10-23T12:00:00Z');
    exportRepo.findLatestByHousehold.mockResolvedValue(
      makeExport({ status: 'ready', downloadUrl: 'https://dl.example/x', expiresAt }),
    );

    expect(await useCase.execute({ householdId: HOUSEHOLD_ID, now: NOW })).toEqual({
      status: 'ready',
      url: 'https://dl.example/x',
      expiresAt,
    });
  });

  it('hides the url once the export expired', async () => {
    const expiresAt = new Date('2026-10-22T11:59:59Z');
    exportRepo.findLatestByHousehold.mockResolvedValue(
      makeExport({ status: 'ready', downloadUrl: 'https://dl.example/x', expiresAt }),
    );

    expect(await useCase.execute({ householdId: HOUSEHOLD_ID, now: NOW })).toEqual({
      status: 'ready',
      url: null,
      expiresAt,
    });
  });

  it('returns failed without a url', async () => {
    exportRepo.findLatestByHousehold.mockResolvedValue(makeExport({ status: 'failed' }));

    expect(await useCase.execute({ householdId: HOUSEHOLD_ID, now: NOW })).toEqual({
      status: 'failed',
      url: null,
      expiresAt: null,
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId, HouseholdExportId } from '@power-budget/core';
import type { HouseholdExportRepository, HouseholdExportQueuePort } from '../../domain/ports.js';
import { ExportHouseholdDataUseCase } from './ExportHouseholdDataUseCase.js';

const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;
const EXPORT_ID = '01900000-0000-7000-8000-000000000010' as HouseholdExportId;

describe('ExportHouseholdDataUseCase', () => {
  let exportRepo: ReturnType<typeof mock<HouseholdExportRepository>>;
  let exportQueue: ReturnType<typeof mock<HouseholdExportQueuePort>>;
  let useCase: ExportHouseholdDataUseCase;

  beforeEach(() => {
    exportRepo = mock<HouseholdExportRepository>();
    exportQueue = mock<HouseholdExportQueuePort>();
    useCase = new ExportHouseholdDataUseCase(exportRepo, exportQueue);
  });

  it('creates an export record and enqueues a job', async () => {
    exportRepo.create.mockResolvedValue({
      id: EXPORT_ID,
      householdId: HOUSEHOLD_ID,
      requestedByUserId: USER_ID,
      status: 'pending',
      downloadUrl: null,
      expiresAt: null,
      createdAt: new Date(),
    });
    exportQueue.enqueue.mockResolvedValue(undefined);

    const result = await useCase.execute({
      householdId: HOUSEHOLD_ID,
      requestedByUserId: USER_ID,
    });

    expect(exportRepo.create).toHaveBeenCalledOnce();
    expect(exportQueue.enqueue).toHaveBeenCalledOnce();
    expect(result.status).toBe('pending');
    expect(result.exportId).toBeDefined();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, BankConnectionId } from '@power-budget/core';
import { BankSyncSchedulerService } from '../BankSyncSchedulerService.js';
import type { BankSyncSchedulerUseCase } from '../../application/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../domain/ports.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_CONNECTION_ID = '01900000-0000-7000-8000-000000000002' as BankConnectionId;

describe('BankSyncSchedulerService', () => {
  let schedulerUseCase: ReturnType<typeof mock<BankSyncSchedulerUseCase>>;
  let syncQueue: ReturnType<typeof mock<BankSyncQueuePort>>;
  let service: BankSyncSchedulerService;

  beforeEach(() => {
    schedulerUseCase = mock<BankSyncSchedulerUseCase>();
    syncQueue = mock<BankSyncQueuePort>();
    service = new BankSyncSchedulerService(schedulerUseCase, syncQueue);
  });

  it('scheduleBankSync calls use case and enqueues each returned target', async () => {
    schedulerUseCase.execute.mockResolvedValue([
      { connectionId: TEST_CONNECTION_ID, householdId: TEST_HOUSEHOLD_ID },
    ]);
    syncQueue.enqueue.mockResolvedValue({ jobId: 'job-1' });

    await service.scheduleBankSync();

    expect(schedulerUseCase.execute).toHaveBeenCalledOnce();
    expect(syncQueue.enqueue).toHaveBeenCalledWith({
      connectionId: TEST_CONNECTION_ID,
      householdId: TEST_HOUSEHOLD_ID,
    });
  });

  it('does not call syncQueue.enqueue when no targets returned', async () => {
    schedulerUseCase.execute.mockResolvedValue([]);

    await service.scheduleBankSync();

    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues all targets when multiple connections returned', async () => {
    const targets = [
      { connectionId: 'conn-1' as BankConnectionId, householdId: TEST_HOUSEHOLD_ID },
      { connectionId: 'conn-2' as BankConnectionId, householdId: TEST_HOUSEHOLD_ID },
    ];
    schedulerUseCase.execute.mockResolvedValue(targets);
    syncQueue.enqueue.mockResolvedValue({ jobId: 'job-2' });

    await service.scheduleBankSync();

    expect(syncQueue.enqueue).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankSyncSchedulerUseCase } from '../../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../../domain/bank/ports.js';
import { BankSyncSchedulerService } from '../BankSyncSchedulerService.js';

const HOUSEHOLD_ID = 'hh-1' as HouseholdId;
const CONN_A = 'conn-a' as BankConnectionId;
const CONN_B = 'conn-b' as BankConnectionId;

describe('BankSyncSchedulerService', () => {
  it('enqueues every active connection with the 4-hour UTC slot as scheduledAt', async () => {
    const useCase = mock<BankSyncSchedulerUseCase>();
    useCase.execute.mockResolvedValue([
      { connectionId: CONN_A, householdId: HOUSEHOLD_ID },
      { connectionId: CONN_B, householdId: HOUSEHOLD_ID },
    ]);
    const queue = mock<BankSyncQueuePort>();
    queue.enqueue.mockResolvedValue({ jobId: 'j' });
    const service = new BankSyncSchedulerService(useCase, queue);

    // A tick that fires a few seconds late still lands in the 08:00 slot.
    await service.scheduleBankSync(new Date('2026-10-21T08:00:07.250Z'));

    const slot = new Date('2026-10-21T08:00:00.000Z');
    expect(queue.enqueue.mock.calls).toEqual([
      [{ connectionId: CONN_A, householdId: HOUSEHOLD_ID, scheduledAt: slot }],
      [{ connectionId: CONN_B, householdId: HOUSEHOLD_ID, scheduledAt: slot }],
    ]);
  });
});

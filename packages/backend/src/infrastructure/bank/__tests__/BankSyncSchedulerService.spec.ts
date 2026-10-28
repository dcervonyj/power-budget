import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankSyncSchedulerUseCase } from '../../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../../domain/bank/ports.js';
import { BankSyncSchedulerService } from '../BankSyncSchedulerService.js';

const HOUSEHOLD_ID = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const CONN_A = BankConnectionId.of('01900000-56de-73cd-85a3-120bb4d80098');
const CONN_B = BankConnectionId.of('01900000-dcc1-70bf-8cb6-85cec8cdd223');

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
      [
        {
          connectionId: CONN_A,
          householdId: HOUSEHOLD_ID,
          trigger: 'scheduled',
          attended: false,
          scheduledAt: slot,
        },
      ],
      [
        {
          connectionId: CONN_B,
          householdId: HOUSEHOLD_ID,
          trigger: 'scheduled',
          attended: false,
          scheduledAt: slot,
        },
      ],
    ]);
  });

  it('keeps enqueuing the remaining connections when one enqueue fails, then reports the failure', async () => {
    const useCase = mock<BankSyncSchedulerUseCase>();
    useCase.execute.mockResolvedValue([
      { connectionId: CONN_A, householdId: HOUSEHOLD_ID },
      { connectionId: CONN_B, householdId: HOUSEHOLD_ID },
    ]);
    const queue = mock<BankSyncQueuePort>();
    queue.enqueue.mockRejectedValueOnce(new Error('Queue unavailable'));
    queue.enqueue.mockResolvedValueOnce({ jobId: 'j' });
    const service = new BankSyncSchedulerService(useCase, queue);

    await expect(service.scheduleBankSync(new Date('2026-10-21T08:00:00.000Z'))).rejects.toThrow(
      '1 of 2 bank sync enqueue(s) failed',
    );

    expect(queue.enqueue.mock.calls.map(([payload]) => payload.connectionId)).toEqual([
      CONN_A,
      CONN_B,
    ]);
  });
});

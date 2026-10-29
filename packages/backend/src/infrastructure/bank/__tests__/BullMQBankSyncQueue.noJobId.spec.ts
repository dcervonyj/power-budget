import { describe, expect, it } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Job, Queue } from 'bullmq';
import { BankConnectionId, HouseholdId } from '@power-budget/core';
import { BullMQBankSyncQueue } from '../BullMQBankSyncQueue.js';

describe('BullMQBankSyncQueue without a job id', () => {
  it('rejects instead of returning an empty job id', async () => {
    const queue = createMock<Queue>();
    queue.add.mockResolvedValue(createMock<Job>({ id: undefined }));

    await expect(
      new BullMQBankSyncQueue(queue).enqueue({
        connectionId: BankConnectionId.of('0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'),
        householdId: HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6'),
        trigger: 'scheduled',
        attended: false,
        scheduledAt: new Date('2026-10-21T08:00:00.000Z'),
      }),
    ).rejects.toThrow('without a job id');
  });
});

import { describe, it, expect } from 'vitest';
import type { HouseholdExportId, HouseholdId } from '@power-budget/core';
import { ALL_QUEUES, QUEUE_HOUSEHOLD_EXPORT } from '../queue/queue.constants.js';
import { DeferredHouseholdExportQueue } from './DeferredHouseholdExportQueue.js';

describe('DeferredHouseholdExportQueue (CLN-056 / D6)', () => {
  it('resolves without touching Redis: it has no queue dependency to enqueue to', async () => {
    const queue = new DeferredHouseholdExportQueue();

    await expect(
      queue.enqueue({
        exportId: '01900000-0000-7000-8000-000000000010' as HouseholdExportId,
        householdId: '01900000-0000-7000-8000-000000000001' as HouseholdId,
      }),
    ).resolves.toBeUndefined();
    expect(DeferredHouseholdExportQueue.length).toBe(0);
  });

  it('registers no household-export BullMQ queue until a processor exists', () => {
    expect(ALL_QUEUES).not.toContain(QUEUE_HOUSEHOLD_EXPORT);
  });
});

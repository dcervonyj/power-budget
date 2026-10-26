import { describe, it, expect, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import type { Job, Queue } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import { BullMQBankSyncQueue } from '../BullMQBankSyncQueue.js';
import { DEFAULT_JOB_OPTIONS } from '../../queue/retry-config.js';

const CONNECTION_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' as BankConnectionId;
const HOUSEHOLD_ID = 'hh-1' as HouseholdId;

describe('BullMQBankSyncQueue', () => {
  let queue: MockProxy<Queue>;
  let syncQueue: BullMQBankSyncQueue;

  beforeEach(() => {
    queue = mock<Queue>();
    queue.add.mockResolvedValue(mock<Job>({ id: 'job-1' }));
    syncQueue = new BullMQBankSyncQueue(queue);
  });

  it('gives a scheduled job a deterministic, colon-free id per connection and slot', async () => {
    const result = await syncQueue.enqueue({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      trigger: 'scheduled',
      attended: false,
      scheduledAt: new Date('2026-10-21T08:00:00.000Z'),
    });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(queue.add).toHaveBeenCalledWith(
      'sync',
      {
        connectionId: CONNECTION_ID,
        householdId: HOUSEHOLD_ID,
        trigger: 'scheduled',
        attended: false,
      },
      {
        ...DEFAULT_JOB_OPTIONS,
        deduplication: { id: `bank-sync-${CONNECTION_ID}` },
        jobId: `bank-sync-${CONNECTION_ID}-20261021T0800`,
      },
    );
  });

  it('enqueues the same slot twice with the same job id, so BullMQ keeps one job', async () => {
    const scheduledAt = new Date('2026-10-21T08:00:00.000Z');

    await syncQueue.enqueue({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      trigger: 'scheduled',
      attended: false,
      scheduledAt,
    });
    await syncQueue.enqueue({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      trigger: 'scheduled',
      attended: false,
      scheduledAt,
    });

    const jobIds = queue.add.mock.calls.map((call) => call[2]?.jobId);
    expect(jobIds).toEqual([
      `bank-sync-${CONNECTION_ID}-20261021T0800`,
      `bank-sync-${CONNECTION_ID}-20261021T0800`,
    ]);
  });

  it('deduplicates an on-demand sync per connection without a fixed job id', async () => {
    const since = new Date('2026-10-01T00:00:00.000Z');

    await syncQueue.enqueue({
      connectionId: CONNECTION_ID,
      householdId: HOUSEHOLD_ID,
      trigger: 'manual',
      attended: true,
      since,
    });

    expect(queue.add).toHaveBeenCalledWith(
      'sync',
      {
        connectionId: CONNECTION_ID,
        householdId: HOUSEHOLD_ID,
        trigger: 'manual',
        attended: true,
        since,
      },
      { ...DEFAULT_JOB_OPTIONS, deduplication: { id: `bank-sync-${CONNECTION_ID}` } },
    );
  });
});

import { Injectable } from '@nestjs/common';
import { boundedEnqueue } from '../queue/bounded-enqueue.js';
import { InjectQueue } from '@nestjs/bullmq';
import type { JobsOptions, Queue } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankSyncQueuePort, SyncRunStartOptions } from '../../domain/bank/ports.js';
import { QUEUE_BANK_SYNC } from '../queue/queue.constants.js';
import { DEFAULT_JOB_OPTIONS } from '../queue/retry-config.js';

@Injectable()
export class BullMQBankSyncQueue implements BankSyncQueuePort {
  constructor(@InjectQueue(QUEUE_BANK_SYNC) private readonly queue: Queue) {}

  async enqueue(payload: {
    connectionId: BankConnectionId;
    householdId: HouseholdId;
    trigger: SyncRunStartOptions['trigger'];
    attended: boolean;
    since?: Date;
    scheduledAt?: Date;
  }): Promise<{ jobId: string }> {
    const { scheduledAt, ...data } = payload;
    const job = await boundedEnqueue(
      this.queue.add('sync', data, this.jobOptions(payload.connectionId, scheduledAt)),
      `bank sync for ${payload.connectionId}`,
    );

    return { jobId: job.id ?? '' };
  }

  private jobOptions(connectionId: BankConnectionId, scheduledAt: Date | undefined): JobsOptions {
    // At most one pending/running sync per connection, whoever enqueues it.
    const options: JobsOptions = {
      ...DEFAULT_JOB_OPTIONS,
      deduplication: { id: `bank-sync-${connectionId}` },
    };
    if (scheduledAt === undefined) {
      return options;
    }

    // BullMQ rejects custom ids with a single ':', so the slot is written without colons.
    return { ...options, jobId: `bank-sync-${connectionId}-${this.slotKey(scheduledAt)}` };
  }

  private slotKey(scheduledAt: Date): string {
    return scheduledAt.toISOString().slice(0, 16).replace(/[-:]/g, '');
  }
}

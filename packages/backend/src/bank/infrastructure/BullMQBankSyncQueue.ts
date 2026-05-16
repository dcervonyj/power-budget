import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankSyncQueuePort } from '../domain/ports.js';
import { QUEUE_BANK_SYNC } from '../../shared/infrastructure/queue/queue.constants.js';
import { DEFAULT_JOB_OPTIONS } from '../../shared/infrastructure/queue/retry-config.js';

@Injectable()
export class BullMQBankSyncQueue implements BankSyncQueuePort {
  constructor(@InjectQueue(QUEUE_BANK_SYNC) private readonly queue: Queue) {}

  async enqueue(payload: {
    connectionId: BankConnectionId;
    householdId: HouseholdId;
    since?: Date;
  }): Promise<{ jobId: string }> {
    const job = await this.queue.add('sync', payload, DEFAULT_JOB_OPTIONS);
    return { jobId: job.id ?? '' };
  }
}

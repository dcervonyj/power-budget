import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { HouseholdExportId, HouseholdId } from '@power-budget/core';
import type { HouseholdExportQueuePort } from '../domain/ports.js';
import { QUEUE_HOUSEHOLD_EXPORT } from '../../shared/infrastructure/queue/queue.constants.js';
import { DEFAULT_JOB_OPTIONS } from '../../shared/infrastructure/queue/retry-config.js';

@Injectable()
export class BullMQHouseholdExportQueue implements HouseholdExportQueuePort {
  constructor(@InjectQueue(QUEUE_HOUSEHOLD_EXPORT) private readonly queue: Queue) {}

  async enqueue(payload: { exportId: HouseholdExportId; householdId: HouseholdId }): Promise<void> {
    await this.queue.add('export', payload, DEFAULT_JOB_OPTIONS);
  }
}

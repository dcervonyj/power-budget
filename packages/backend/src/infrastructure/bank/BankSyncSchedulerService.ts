import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../domain/bank/ports.js';

const SYNC_INTERVAL_MS = 4 * 3600 * 1000;

@Injectable()
export class BankSyncSchedulerService {
  constructor(
    private readonly schedulerUseCase: BankSyncSchedulerUseCase,
    private readonly syncQueue: BankSyncQueuePort,
  ) {}

  /** Every 4 hours (UTC). Each connection gets one job per 4-hour slot. */
  @Cron('0 */4 * * *', { name: 'bank-sync-schedule', timeZone: 'UTC' })
  async scheduleBankSync(now: Date = new Date()): Promise<void> {
    const scheduledAt = new Date(Math.floor(now.getTime() / SYNC_INTERVAL_MS) * SYNC_INTERVAL_MS);
    const targets = await this.schedulerUseCase.execute();
    for (const target of targets) {
      await this.syncQueue.enqueue({
        connectionId: target.connectionId,
        householdId: target.householdId,
        trigger: 'scheduled',
        attended: false,
        scheduledAt,
      });
    }
  }
}

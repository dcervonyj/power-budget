import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../domain/bank/ports.js';

const SYNC_INTERVAL_MS = 4 * 3600 * 1000;

@Injectable()
export class BankSyncSchedulerService {
  private readonly logger = new Logger(BankSyncSchedulerService.name);

  constructor(
    private readonly schedulerUseCase: BankSyncSchedulerUseCase,
    private readonly syncQueue: BankSyncQueuePort,
  ) {}

  /**
   * Every 4 hours (UTC). Each connection gets one job per 4-hour slot. One target failing to
   * enqueue (Redis unreachable for longer than the enqueue bound) must not skip the others:
   * every failure is logged, the loop goes on, and the tick rejects with an AggregateError at
   * the end. The connections that failed are picked up again by the next slot.
   */
  @Cron('0 */4 * * *', { name: 'bank-sync-schedule', timeZone: 'UTC' })
  async scheduleBankSync(now: Date = new Date()): Promise<void> {
    const scheduledAt = new Date(Math.floor(now.getTime() / SYNC_INTERVAL_MS) * SYNC_INTERVAL_MS);
    const targets = await this.schedulerUseCase.execute();
    const failures: unknown[] = [];
    for (const target of targets) {
      try {
        await this.syncQueue.enqueue({
          connectionId: target.connectionId,
          householdId: target.householdId,
          trigger: 'scheduled',
          attended: false,
          scheduledAt,
        });
      } catch (err) {
        this.logger.warn(
          `Bank sync of connection ${target.connectionId} not enqueued for slot ${scheduledAt.toISOString()}: ${err instanceof Error ? err.message : String(err)}`,
        );
        failures.push(err);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `${failures.length} of ${targets.length} bank sync enqueue(s) failed`,
      );
    }
  }
}

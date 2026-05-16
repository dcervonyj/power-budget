import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import type { BankSyncQueuePort } from '../../domain/bank/ports.js';

@Injectable()
export class BankSyncSchedulerService {
  constructor(
    private readonly schedulerUseCase: BankSyncSchedulerUseCase,
    private readonly syncQueue: BankSyncQueuePort,
  ) {}

  @Cron('0 */4 * * *')
  async scheduleBankSync(): Promise<void> {
    const targets = await this.schedulerUseCase.execute();
    for (const target of targets) {
      await this.syncQueue.enqueue({
        connectionId: target.connectionId,
        householdId: target.householdId,
      });
    }
  }
}

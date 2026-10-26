import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PurgeDeletedHouseholdsUseCase } from '../../../application/auth/use-cases/PurgeDeletedHouseholdsUseCase.js';

@Injectable()
export class HouseholdPurgeCronService {
  private readonly logger = new Logger(HouseholdPurgeCronService.name);

  constructor(
    @Inject(PurgeDeletedHouseholdsUseCase)
    private readonly purgeUseCase: PurgeDeletedHouseholdsUseCase,
  ) {}

  /** Daily 03:30 UTC: hard-delete households whose 30-day grace period has passed. */
  @Cron('30 3 * * *', { name: 'household-purge', timeZone: 'UTC' })
  async runPurge(): Promise<void> {
    const output = await this.purgeUseCase.execute(new Date());

    this.logger.log(
      `household purge: ${output.purged.length} purged, ${output.failed.length} failed`,
    );
    for (const failure of output.failed) {
      this.logger.error(`household purge failed for ${failure.householdId}`, failure.error);
    }
  }
}

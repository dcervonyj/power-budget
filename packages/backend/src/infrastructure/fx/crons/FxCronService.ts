import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IsoDate } from '@power-budget/core';
import { IngestDailyFxRatesUseCase } from '../../../application/fx/use-cases/IngestDailyFxRatesUseCase.js';

/** Days back from today (re)checked each run, oldest first, to heal missed runs. */
export const FX_CATCH_UP_DAY_OFFSETS: readonly number[] = [3, 2, 1, 0];
const ONE_DAY_MS = 86_400_000;

@Injectable()
export class FxCronService {
  private readonly logger = new Logger(FxCronService.name);

  constructor(private readonly ingest: IngestDailyFxRatesUseCase) {}

  /**
   * Weekdays 17:00 Warsaw time: after the ECB (~16:00 CET) and NBP (~12:00)
   * publications. Idempotent per date and currency, so overlapping catch-up
   * days cost one indexed lookup each once complete.
   */
  @Cron('0 17 * * 1-5', { name: 'fx-daily-ingest', timeZone: 'Europe/Warsaw' })
  async runDailyIngest(now: Date = new Date()): Promise<void> {
    for (const daysBack of FX_CATCH_UP_DAY_OFFSETS) {
      const day = new Date(now.getTime() - daysBack * ONE_DAY_MS);
      await this.ingestOne(IsoDate.of(day.toISOString().slice(0, 10)));
    }
  }

  private async ingestOne(date: IsoDate): Promise<void> {
    try {
      const result = await this.ingest.execute(date);
      for (const warning of result.warnings) {
        this.logger.warn(warning);
      }
      if (!result.alreadyComplete) {
        this.logger.log(
          `FX ${date}: saved ${result.saved}, missing [${result.missing.join(', ')}]`,
        );
      }
    } catch (err) {
      this.logger.error(`FX ingest failed for ${date}`, err instanceof Error ? err.stack : err);
    }
  }
}

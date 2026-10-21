import { Module } from '@nestjs/common';
import { FxModule } from './FxModule.js';
import { DrizzleFxRateRepository } from './DrizzleFxRateRepository.js';
import { EcbFxRateProvider } from './EcbFxRateProvider.js';
import { NbpFxRateProvider } from './NbpFxRateProvider.js';
import { FxCronService } from './crons/FxCronService.js';
import { IngestDailyFxRatesUseCase } from '../../application/fx/use-cases/IngestDailyFxRatesUseCase.js';

function systemClock(): Date {
  return new Date();
}

/** Worker-only: the daily ECB + NBP ingest cron. Imported by WorkerModule only. */
@Module({
  imports: [FxModule],
  providers: [
    {
      provide: EcbFxRateProvider,
      useFactory: () => new EcbFxRateProvider(fetch, systemClock),
    },
    {
      provide: NbpFxRateProvider,
      useFactory: () => new NbpFxRateProvider(fetch, systemClock),
    },
    {
      provide: IngestDailyFxRatesUseCase,
      inject: [EcbFxRateProvider, NbpFxRateProvider, DrizzleFxRateRepository],
      useFactory: (ecb: EcbFxRateProvider, nbp: NbpFxRateProvider, repo: DrizzleFxRateRepository) =>
        new IngestDailyFxRatesUseCase(ecb, nbp, repo),
    },
    FxCronService,
  ],
})
export class FxWorkerModule {}

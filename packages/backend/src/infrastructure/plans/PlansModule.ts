import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { FxModule } from '../fx/FxModule.js';
import { DrizzleFxRateRepository } from '../fx/DrizzleFxRateRepository.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActivityReader } from './DrizzlePlanActivityReader.js';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { DrizzlePlannedItemRepository } from './DrizzlePlannedItemRepository.js';
import { DrizzlePlannedItemVersionRepository } from './DrizzlePlannedItemVersionRepository.js';
import { PlanFxRatesLoader } from '../../application/plans/plan-fx-rates.js';
import { PlanActualsService } from '../../application/plans/PlanActualsService.js';

/**
 * Plan adapters shared by the API and the worker. Processors and the
 * period-close cron live in PlansWorkerModule, which only the worker loads.
 * PlanActualsService (core computePlanActuals) is the one source of dashboard numbers.
 */
@Module({
  imports: [DatabaseModule, QueueModule, FxModule],
  providers: [
    DrizzlePlanRepository,
    DrizzlePlanActivityReader,
    DrizzleUnplannedTransactionReader,
    DrizzlePlannedItemRepository,
    DrizzlePlannedItemVersionRepository,
    {
      provide: PlanFxRatesLoader,
      inject: [DrizzleFxRateRepository],
      useFactory: (fxRepo: DrizzleFxRateRepository) => new PlanFxRatesLoader(fxRepo),
    },
    {
      provide: PlanActualsService,
      inject: [DrizzlePlannedItemRepository, DrizzlePlanActivityReader, PlanFxRatesLoader],
      useFactory: (
        items: DrizzlePlannedItemRepository,
        activity: DrizzlePlanActivityReader,
        fxRates: PlanFxRatesLoader,
      ) => new PlanActualsService(items, activity, fxRates),
    },
  ],
  exports: [
    DrizzlePlanRepository,
    DrizzlePlanActivityReader,
    DrizzleUnplannedTransactionReader,
    DrizzlePlannedItemRepository,
    DrizzlePlannedItemVersionRepository,
    PlanFxRatesLoader,
    PlanActualsService,
  ],
})
export class PlansModule {}

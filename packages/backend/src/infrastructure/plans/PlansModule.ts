import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from './DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { DrizzleHouseholdDashboardReader } from './DrizzleHouseholdDashboardReader.js';
import { DrizzlePlannedItemRepository } from './DrizzlePlannedItemRepository.js';
import { DrizzlePlannedItemVersionRepository } from './DrizzlePlannedItemVersionRepository.js';

/**
 * Plan adapters shared by the API and the worker. Processors and the
 * period-close cron live in PlansWorkerModule, which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
    DrizzlePlannedItemRepository,
    DrizzlePlannedItemVersionRepository,
  ],
  exports: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
    DrizzlePlannedItemRepository,
    DrizzlePlannedItemVersionRepository,
  ],
})
export class PlansModule {}

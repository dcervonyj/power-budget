import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from './DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { DrizzleHouseholdDashboardReader } from './DrizzleHouseholdDashboardReader.js';

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
  ],
  exports: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
  ],
})
export class PlansModule {}

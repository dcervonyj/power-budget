import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from './DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { DrizzleHouseholdDashboardReader } from './DrizzleHouseholdDashboardReader.js';
import { RecomputePlanActualsProcessor } from './RecomputePlanActualsProcessor.js';

@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
    RecomputePlanActualsProcessor,
  ],
  exports: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
  ],
})
export class PlansModule {}

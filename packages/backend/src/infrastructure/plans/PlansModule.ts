import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from './DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { DrizzleHouseholdDashboardReader } from './DrizzleHouseholdDashboardReader.js';
import { DrizzleLeftoverSnapshotRepository } from './DrizzleLeftoverSnapshotRepository.js';
import { RecomputePlanActualsProcessor } from './RecomputePlanActualsProcessor.js';
import { PeriodCloseProcessor } from './workers/PeriodCloseProcessor.js';
import { PlansCronService } from './crons/PlansCronService.js';
import { ClosePeriodSnapshotUseCase } from '../../application/plans/use-cases/ClosePeriodSnapshotUseCase.js';
import { PeriodCloseUseCase } from '../../application/plans/use-cases/PeriodCloseUseCase.js';

@Module({
  imports: [DatabaseModule, QueueModule, ScheduleModule.forRoot()],
  providers: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
    DrizzleLeftoverSnapshotRepository,
    RecomputePlanActualsProcessor,
    {
      provide: ClosePeriodSnapshotUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlanActualsReader, DrizzleLeftoverSnapshotRepository],
      useFactory: (
        planRepo: DrizzlePlanRepository,
        actualsReader: DrizzlePlanActualsReader,
        leftoverRepo: DrizzleLeftoverSnapshotRepository,
      ) => new ClosePeriodSnapshotUseCase(planRepo, actualsReader, leftoverRepo, randomUUID),
    },
    {
      provide: PeriodCloseUseCase,
      inject: [DrizzlePlanRepository, ClosePeriodSnapshotUseCase],
      useFactory: (planRepo: DrizzlePlanRepository, closeSnapshot: ClosePeriodSnapshotUseCase) =>
        new PeriodCloseUseCase(planRepo, closeSnapshot),
    },
    {
      provide: PeriodCloseProcessor,
      inject: [PeriodCloseUseCase],
      useFactory: (useCase: PeriodCloseUseCase) => new PeriodCloseProcessor(useCase),
    },
    PlansCronService,
  ],
  exports: [
    DrizzlePlanRepository,
    DrizzlePlanActualsReader,
    DrizzleUnplannedTransactionReader,
    DrizzleHouseholdDashboardReader,
  ],
})
export class PlansModule {}

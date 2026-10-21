import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { PlansModule } from './PlansModule.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from './DrizzlePlanActualsReader.js';
import { DrizzleLeftoverSnapshotRepository } from './DrizzleLeftoverSnapshotRepository.js';
import { RecomputePlanActualsProcessor } from './RecomputePlanActualsProcessor.js';
import { PeriodCloseProcessor } from './workers/PeriodCloseProcessor.js';
import { PlansCronService } from './crons/PlansCronService.js';
import { ClosePeriodSnapshotUseCase } from '../../application/plans/use-cases/ClosePeriodSnapshotUseCase.js';
import { PeriodCloseUseCase } from '../../application/plans/use-cases/PeriodCloseUseCase.js';

/**
 * Worker-only: plan-actuals refresh and period-close processors plus the
 * daily period-close cron. Imported by WorkerModule only.
 */
@Module({
  imports: [DatabaseModule, QueueModule, PlansModule],
  providers: [
    DrizzleLeftoverSnapshotRepository,
    RecomputePlanActualsProcessor,
    {
      provide: ClosePeriodSnapshotUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlanActualsReader, DrizzleLeftoverSnapshotRepository],
      useFactory: (
        planRepo: DrizzlePlanRepository,
        actualsReader: DrizzlePlanActualsReader,
        leftoverRepo: DrizzleLeftoverSnapshotRepository,
      ) => new ClosePeriodSnapshotUseCase(planRepo, actualsReader, leftoverRepo, uuidv7),
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
})
export class PlansWorkerModule {}

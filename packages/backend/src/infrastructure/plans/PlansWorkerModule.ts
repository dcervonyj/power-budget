import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { PlansModule } from './PlansModule.js';
import { DrizzlePlanRepository } from './DrizzlePlanRepository.js';
import { DrizzleLeftoverSnapshotRepository } from './DrizzleLeftoverSnapshotRepository.js';
import { PeriodCloseProcessor } from './workers/PeriodCloseProcessor.js';
import { PlansCronService } from './crons/PlansCronService.js';
import { PlanActualsService } from '../../application/plans/PlanActualsService.js';
import { ClosePeriodSnapshotUseCase } from '../../application/plans/use-cases/ClosePeriodSnapshotUseCase.js';
import { PeriodCloseUseCase } from '../../application/plans/use-cases/PeriodCloseUseCase.js';

/**
 * Worker-only: the period-close processor plus the
 * daily period-close cron. Imported by WorkerModule only.
 */
@Module({
  imports: [DatabaseModule, QueueModule, PlansModule],
  providers: [
    DrizzleLeftoverSnapshotRepository,
    {
      provide: ClosePeriodSnapshotUseCase,
      inject: [DrizzlePlanRepository, PlanActualsService, DrizzleLeftoverSnapshotRepository],
      useFactory: (
        planRepo: DrizzlePlanRepository,
        actualsReader: PlanActualsService,
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

import { Module } from '@nestjs/common';
import { PlansModule } from '../../infrastructure/plans/PlansModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from '../../infrastructure/plans/DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from '../../infrastructure/plans/DrizzleUnplannedTransactionReader.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../../application/plans/use-cases/GetUnplannedTransactionsUseCase.js';
import { PlansController } from './PlansController.js';

@Module({
  imports: [PlansModule, AuthModule],
  controllers: [PlansController],
  providers: [
    {
      provide: GetPlanDashboardUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlanActualsReader],
      useFactory: (repo: DrizzlePlanRepository, reader: DrizzlePlanActualsReader) =>
        new GetPlanDashboardUseCase(repo, reader),
    },
    {
      provide: GetUnplannedTransactionsUseCase,
      inject: [DrizzlePlanRepository, DrizzleUnplannedTransactionReader],
      useFactory: (
        repo: DrizzlePlanRepository,
        reader: DrizzleUnplannedTransactionReader,
      ) => new GetUnplannedTransactionsUseCase(repo, reader),
    },
  ],
})
export class PlansPresentationModule {}

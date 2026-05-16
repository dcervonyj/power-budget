import { Module } from '@nestjs/common';
import { PlansModule } from '../infrastructure/PlansModule.js';
import { AuthModule } from '../../auth/infrastructure/AuthModule.js';
import { DrizzlePlanRepository } from '../infrastructure/DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from '../infrastructure/DrizzlePlanActualsReader.js';
import { DrizzleUnplannedTransactionReader } from '../infrastructure/DrizzleUnplannedTransactionReader.js';
import { GetPlanDashboardUseCase } from '../application/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../application/use-cases/GetUnplannedTransactionsUseCase.js';
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
      useFactory: (repo: DrizzlePlanRepository, reader: DrizzleUnplannedTransactionReader) =>
        new GetUnplannedTransactionsUseCase(repo, reader),
    },
  ],
})
export class PlansPresentationModule {}

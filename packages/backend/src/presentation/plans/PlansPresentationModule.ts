import { Module } from '@nestjs/common';
import { PlansModule } from '../../infrastructure/plans/PlansModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';
import { DrizzlePlanActualsReader } from '../../infrastructure/plans/DrizzlePlanActualsReader.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';
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
  ],
})
export class PlansPresentationModule {}

import { Module } from '@nestjs/common';
import { PlansModule } from '../../infrastructure/plans/PlansModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';
import { DrizzleHouseholdDashboardReader } from '../../infrastructure/plans/DrizzleHouseholdDashboardReader.js';
import { GetHouseholdDashboardUseCase } from '../../application/households/use-cases/GetHouseholdDashboardUseCase.js';
import { HouseholdsController } from './HouseholdsController.js';

@Module({
  imports: [PlansModule, AuthModule],
  controllers: [HouseholdsController],
  providers: [
    {
      provide: GetHouseholdDashboardUseCase,
      inject: [DrizzlePlanRepository, DrizzleHouseholdDashboardReader],
      useFactory: (
        repo: DrizzlePlanRepository,
        reader: DrizzleHouseholdDashboardReader,
      ) => new GetHouseholdDashboardUseCase(repo, reader),
    },
  ],
})
export class HouseholdsPresentationModule {}

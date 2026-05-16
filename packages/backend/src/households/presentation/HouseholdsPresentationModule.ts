import { Module } from '@nestjs/common';
import { PlansModule } from '../../plans/infrastructure/PlansModule.js';
import { AuthModule } from '../../auth/infrastructure/AuthModule.js';
import { DrizzlePlanRepository } from '../../plans/infrastructure/DrizzlePlanRepository.js';
import { DrizzleHouseholdDashboardReader } from '../../plans/infrastructure/DrizzleHouseholdDashboardReader.js';
import { GetHouseholdDashboardUseCase } from '../application/use-cases/GetHouseholdDashboardUseCase.js';
import { HouseholdsController } from './HouseholdsController.js';

@Module({
  imports: [PlansModule, AuthModule],
  controllers: [HouseholdsController],
  providers: [
    {
      provide: GetHouseholdDashboardUseCase,
      inject: [DrizzlePlanRepository, DrizzleHouseholdDashboardReader],
      useFactory: (repo: DrizzlePlanRepository, reader: DrizzleHouseholdDashboardReader) =>
        new GetHouseholdDashboardUseCase(repo, reader),
    },
  ],
})
export class HouseholdsPresentationModule {}

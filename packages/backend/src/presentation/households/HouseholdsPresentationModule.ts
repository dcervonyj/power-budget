import { Module } from '@nestjs/common';
import { PlansModule } from '../../infrastructure/plans/PlansModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { CategoriesModule } from '../../infrastructure/categories/CategoriesModule.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';
import { DrizzlePlannedItemRepository } from '../../infrastructure/plans/DrizzlePlannedItemRepository.js';
import { DrizzlePlanActivityReader } from '../../infrastructure/plans/DrizzlePlanActivityReader.js';
import { DrizzleCategoryRepository } from '../../infrastructure/categories/DrizzleCategoryRepository.js';
import { DrizzleCategoryPrivacyRepository } from '../../infrastructure/categories/DrizzleCategoryPrivacyRepository.js';
import { PlanFxRatesLoader } from '../../application/plans/plan-fx-rates.js';
import { GetHouseholdDashboardUseCase } from '../../application/households/use-cases/GetHouseholdDashboardUseCase.js';
import { HouseholdsController } from './HouseholdsController.js';

@Module({
  imports: [PlansModule, AuthModule, CategoriesModule],
  controllers: [HouseholdsController],
  providers: [
    {
      provide: GetHouseholdDashboardUseCase,
      inject: [
        DrizzlePlanRepository,
        DrizzlePlannedItemRepository,
        DrizzlePlanActivityReader,
        DrizzleCategoryRepository,
        DrizzleCategoryPrivacyRepository,
        PlanFxRatesLoader,
      ],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        activity: DrizzlePlanActivityReader,
        categories: DrizzleCategoryRepository,
        privacy: DrizzleCategoryPrivacyRepository,
        fxRates: PlanFxRatesLoader,
      ) => new GetHouseholdDashboardUseCase(plans, items, activity, categories, privacy, fxRates),
    },
  ],
})
export class HouseholdsPresentationModule {}

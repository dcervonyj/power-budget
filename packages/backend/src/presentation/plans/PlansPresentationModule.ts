import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { PlansModule } from '../../infrastructure/plans/PlansModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { AuditModule, REDACTING_AUDIT_LOGGER } from '../../infrastructure/audit/AuditModule.js';
import { CategoriesModule } from '../../infrastructure/categories/CategoriesModule.js';
import { DrizzlePlanRepository } from '../../infrastructure/plans/DrizzlePlanRepository.js';
import { DrizzlePlannedItemRepository } from '../../infrastructure/plans/DrizzlePlannedItemRepository.js';
import { DrizzlePlannedItemVersionRepository } from '../../infrastructure/plans/DrizzlePlannedItemVersionRepository.js';
import { PlanActualsService } from '../../application/plans/PlanActualsService.js';
import { DrizzleUnplannedTransactionReader } from '../../infrastructure/plans/DrizzleUnplannedTransactionReader.js';
import { DrizzleCategoryRepository } from '../../infrastructure/categories/DrizzleCategoryRepository.js';
import { AuditLogPortAdapter } from '../../infrastructure/plans/AuditLogPortAdapter.js';
import type { AuditLogger } from '../../domain/audit/ports.js';
import type { AuditLogPort } from '../../domain/plans/ports.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../../application/plans/use-cases/GetUnplannedTransactionsUseCase.js';
import { ListPlansUseCase } from '../../application/plans/use-cases/ListPlansUseCase.js';
import { GetPlanUseCase } from '../../application/plans/use-cases/GetPlanUseCase.js';
import { CreatePlanUseCase } from '../../application/plans/use-cases/CreatePlanUseCase.js';
import { UpdatePlanUseCase } from '../../application/plans/use-cases/UpdatePlanUseCase.js';
import { ArchivePlanUseCase } from '../../application/plans/use-cases/ArchivePlanUseCase.js';
import { ClonePlanFromPreviousUseCase } from '../../application/plans/use-cases/ClonePlanFromPreviousUseCase.js';
import { ListPlannedItemsUseCase } from '../../application/plans/use-cases/ListPlannedItemsUseCase.js';
import { AddPlannedItemUseCase } from '../../application/plans/use-cases/AddPlannedItemUseCase.js';
import { UpdatePlannedItemUseCase } from '../../application/plans/use-cases/UpdatePlannedItemUseCase.js';
import { RemovePlannedItemUseCase } from '../../application/plans/use-cases/RemovePlannedItemUseCase.js';
import { GetPlannedItemHistoryUseCase } from '../../application/plans/use-cases/GetPlannedItemHistoryUseCase.js';
import { PlansController } from './PlansController.js';

const PLANS_AUDIT_LOG = 'PLANS_AUDIT_LOG';

@Module({
  imports: [PlansModule, AuthModule, AuditModule, CategoriesModule],
  controllers: [PlansController],
  providers: [
    {
      provide: PLANS_AUDIT_LOG,
      inject: [REDACTING_AUDIT_LOGGER],
      useFactory: (logger: AuditLogger) => new AuditLogPortAdapter(logger),
    },
    {
      provide: ListPlansUseCase,
      inject: [DrizzlePlanRepository],
      useFactory: (plans: DrizzlePlanRepository) => new ListPlansUseCase(plans),
    },
    {
      provide: GetPlanUseCase,
      inject: [DrizzlePlanRepository],
      useFactory: (plans: DrizzlePlanRepository) => new GetPlanUseCase(plans),
    },
    {
      provide: CreatePlanUseCase,
      inject: [DrizzlePlanRepository, PLANS_AUDIT_LOG],
      useFactory: (plans: DrizzlePlanRepository, audit: AuditLogPort) =>
        new CreatePlanUseCase(plans, audit, uuidv7),
    },
    {
      provide: UpdatePlanUseCase,
      inject: [DrizzlePlanRepository, PLANS_AUDIT_LOG],
      useFactory: (plans: DrizzlePlanRepository, audit: AuditLogPort) =>
        new UpdatePlanUseCase(plans, audit),
    },
    {
      provide: ArchivePlanUseCase,
      inject: [DrizzlePlanRepository, PLANS_AUDIT_LOG],
      useFactory: (plans: DrizzlePlanRepository, audit: AuditLogPort) =>
        new ArchivePlanUseCase(plans, audit),
    },
    {
      provide: ClonePlanFromPreviousUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlannedItemRepository, PLANS_AUDIT_LOG],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        audit: AuditLogPort,
      ) => new ClonePlanFromPreviousUseCase(plans, items, audit, uuidv7),
    },
    {
      provide: ListPlannedItemsUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlannedItemRepository],
      useFactory: (plans: DrizzlePlanRepository, items: DrizzlePlannedItemRepository) =>
        new ListPlannedItemsUseCase(plans, items),
    },
    {
      provide: AddPlannedItemUseCase,
      inject: [
        DrizzlePlanRepository,
        DrizzlePlannedItemRepository,
        DrizzleCategoryRepository,
        PLANS_AUDIT_LOG,
      ],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        categories: DrizzleCategoryRepository,
        audit: AuditLogPort,
      ) => new AddPlannedItemUseCase(plans, items, categories, audit, uuidv7),
    },
    {
      provide: UpdatePlannedItemUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlannedItemRepository, PLANS_AUDIT_LOG],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        audit: AuditLogPort,
      ) => new UpdatePlannedItemUseCase(plans, items, audit),
    },
    {
      provide: RemovePlannedItemUseCase,
      inject: [DrizzlePlanRepository, DrizzlePlannedItemRepository, PLANS_AUDIT_LOG],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        audit: AuditLogPort,
      ) => new RemovePlannedItemUseCase(plans, items, audit),
    },
    {
      provide: GetPlannedItemHistoryUseCase,
      inject: [
        DrizzlePlanRepository,
        DrizzlePlannedItemRepository,
        DrizzlePlannedItemVersionRepository,
      ],
      useFactory: (
        plans: DrizzlePlanRepository,
        items: DrizzlePlannedItemRepository,
        versions: DrizzlePlannedItemVersionRepository,
      ) => new GetPlannedItemHistoryUseCase(plans, items, versions),
    },
    {
      provide: GetPlanDashboardUseCase,
      inject: [DrizzlePlanRepository, PlanActualsService],
      useFactory: (repo: DrizzlePlanRepository, reader: PlanActualsService) =>
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

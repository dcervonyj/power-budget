import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { AuditModule, REDACTING_AUDIT_LOGGER } from '../../infrastructure/audit/AuditModule.js';
import { CategoriesModule } from '../../infrastructure/categories/CategoriesModule.js';
import { DrizzleCategoryRepository } from '../../infrastructure/categories/DrizzleCategoryRepository.js';
import { DrizzleCategoryPrivacyRepository } from '../../infrastructure/categories/DrizzleCategoryPrivacyRepository.js';
import type { AuditLogger } from '../../domain/audit/ports.js';
import { ListCategoriesUseCase } from '../../application/categories/use-cases/ListCategoriesUseCase.js';
import { CreateCategoryUseCase } from '../../application/categories/use-cases/CreateCategoryUseCase.js';
import { UpdateCategoryUseCase } from '../../application/categories/use-cases/UpdateCategoryUseCase.js';
import { CategoriesController } from './CategoriesController.js';

@Module({
  imports: [CategoriesModule, AuthModule, AuditModule],
  controllers: [CategoriesController],
  providers: [
    {
      provide: ListCategoriesUseCase,
      inject: [DrizzleCategoryRepository, DrizzleCategoryPrivacyRepository],
      useFactory: (
        categories: DrizzleCategoryRepository,
        privacy: DrizzleCategoryPrivacyRepository,
      ) => new ListCategoriesUseCase(categories, privacy),
    },
    {
      provide: CreateCategoryUseCase,
      inject: [DrizzleCategoryRepository, REDACTING_AUDIT_LOGGER],
      useFactory: (categories: DrizzleCategoryRepository, audit: AuditLogger) =>
        new CreateCategoryUseCase(categories, audit, uuidv7),
    },
    {
      provide: UpdateCategoryUseCase,
      inject: [DrizzleCategoryRepository, DrizzleCategoryPrivacyRepository, REDACTING_AUDIT_LOGGER],
      useFactory: (
        categories: DrizzleCategoryRepository,
        privacy: DrizzleCategoryPrivacyRepository,
        audit: AuditLogger,
      ) => new UpdateCategoryUseCase(categories, privacy, audit),
    },
  ],
})
export class CategoriesPresentationModule {}

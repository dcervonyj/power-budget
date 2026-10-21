import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleCategoryRepository } from './DrizzleCategoryRepository.js';
import { DrizzleCategoryPrivacyRepository } from './DrizzleCategoryPrivacyRepository.js';

@Module({
  imports: [DatabaseModule],
  providers: [DrizzleCategoryRepository, DrizzleCategoryPrivacyRepository],
  exports: [DrizzleCategoryRepository, DrizzleCategoryPrivacyRepository],
})
export class CategoriesModule {}

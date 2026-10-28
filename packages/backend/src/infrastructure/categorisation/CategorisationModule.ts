import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleMerchantRuleRepository } from './DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from './DrizzlePlannedItemResolver.js';

/** Merchant memory adapters (AI-003), shared by the API (learning) and the worker (suggesting). */
@Module({
  imports: [DatabaseModule],
  providers: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver],
  exports: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver],
})
export class CategorisationModule {}

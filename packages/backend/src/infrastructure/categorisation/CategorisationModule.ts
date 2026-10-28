import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleMerchantRuleRepository } from './DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedHintReader } from './DrizzlePlannedHintReader.js';
import { DrizzlePlannedItemResolver } from './DrizzlePlannedItemResolver.js';

/** Merchant memory adapters (AI-003), shared by the API (learning) and the worker (suggesting). */
@Module({
  imports: [DatabaseModule],
  providers: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver, DrizzlePlannedHintReader],
  exports: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver, DrizzlePlannedHintReader],
})
export class CategorisationModule {}

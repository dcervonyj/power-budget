import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleMappingRepository } from './DrizzleMappingRepository.js';
import { DrizzleTransactionRepository } from './DrizzleTransactionRepository.js';
import { DrizzleTransferRepository } from './DrizzleTransferRepository.js';

@Module({
  imports: [DatabaseModule],
  providers: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
  exports: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
})
export class TransactionsModule {}

import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { TransactionsModule } from '../../infrastructure/transactions/TransactionsModule.js';
import { DrizzleMappingRepository } from '../../infrastructure/transactions/DrizzleMappingRepository.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { DrizzleTransferRepository } from '../../infrastructure/transactions/DrizzleTransferRepository.js';
import { CategorisationModule } from '../../infrastructure/categorisation/CategorisationModule.js';
import { DrizzleMerchantRuleRepository } from '../../infrastructure/categorisation/DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from '../../infrastructure/categorisation/DrizzlePlannedItemResolver.js';
import { LearnMerchantRuleUseCase } from '../../application/categorisation/LearnMerchantRuleUseCase.js';
import { AddManualTransactionUseCase } from '../../application/transactions/use-cases/AddManualTransactionUseCase.js';
import { BulkActOnTransactionsUseCase } from '../../application/transactions/use-cases/BulkActOnTransactionsUseCase.js';
import { BulkMapTransactionsUseCase } from '../../application/transactions/use-cases/BulkMapTransactionsUseCase.js';
import { GetTransactionUseCase } from '../../application/transactions/use-cases/GetTransactionUseCase.js';
import { ListTransactionsUseCase } from '../../application/transactions/use-cases/ListTransactionsUseCase.js';
import { MapTransactionUseCase } from '../../application/transactions/use-cases/MapTransactionUseCase.js';
import { MarkAsTransferUseCase } from '../../application/transactions/use-cases/MarkAsTransferUseCase.js';
import { PatchTransactionUseCase } from '../../application/transactions/use-cases/PatchTransactionUseCase.js';
import { UnmarkTransferUseCase } from '../../application/transactions/use-cases/UnmarkTransferUseCase.js';
import { TransactionsController } from './TransactionsController.js';

@Module({
  imports: [TransactionsModule, CategorisationModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: ListTransactionsUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) => new ListTransactionsUseCase(txRepo),
    },
    {
      provide: GetTransactionUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
      ) => new GetTransactionUseCase(txRepo, mappingRepo, transferRepo),
    },
    {
      provide: AddManualTransactionUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) =>
        new AddManualTransactionUseCase(txRepo, uuidv7),
    },
    {
      provide: LearnMerchantRuleUseCase,
      inject: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver],
      useFactory: (rules: DrizzleMerchantRuleRepository, items: DrizzlePlannedItemResolver) =>
        new LearnMerchantRuleUseCase(rules, items, () => new Date()),
    },
    {
      provide: MapTransactionUseCase,
      inject: [
        DrizzleTransactionRepository,
        DrizzleMappingRepository,
        DrizzleTransferRepository,
        LearnMerchantRuleUseCase,
      ],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
        merchantMemory: LearnMerchantRuleUseCase,
      ) => new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, merchantMemory),
    },
    {
      provide: BulkMapTransactionsUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository],
      useFactory: (txRepo: DrizzleTransactionRepository, mappingRepo: DrizzleMappingRepository) =>
        new BulkMapTransactionsUseCase(txRepo, mappingRepo),
    },
    {
      provide: BulkActOnTransactionsUseCase,
      inject: [DrizzleTransactionRepository, DrizzleTransferRepository],
      useFactory: (txRepo: DrizzleTransactionRepository, transferRepo: DrizzleTransferRepository) =>
        new BulkActOnTransactionsUseCase(txRepo, transferRepo),
    },
    {
      provide: MarkAsTransferUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
      ) => new MarkAsTransferUseCase(txRepo, mappingRepo, transferRepo),
    },
    {
      provide: UnmarkTransferUseCase,
      inject: [DrizzleTransactionRepository, DrizzleTransferRepository],
      useFactory: (txRepo: DrizzleTransactionRepository, transferRepo: DrizzleTransferRepository) =>
        new UnmarkTransferUseCase(txRepo, transferRepo),
    },
    {
      provide: PatchTransactionUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) => new PatchTransactionUseCase(txRepo),
    },
  ],
})
export class TransactionsPresentationModule {}

import { Module } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { BankModule } from './BankModule.js';
import { TransactionsModule } from '../transactions/TransactionsModule.js';
import { DrizzleBankConnectionRepository } from './DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from './DrizzleBankAccountRepository.js';
import { DrizzleSyncRunRepository } from './DrizzleSyncRunRepository.js';
import { InMemoryBankConnectorRegistry } from './InMemoryBankConnectorRegistry.js';
import { BullMQBankSyncQueue } from './BullMQBankSyncQueue.js';
import { BankSyncProcessor } from './BankSyncProcessor.js';
import { BankSyncSchedulerService } from './BankSyncSchedulerService.js';
import { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { CategorisationModule } from '../categorisation/CategorisationModule.js';
import { DrizzleMerchantRuleRepository } from '../categorisation/DrizzleMerchantRuleRepository.js';
import { DrizzlePlannedItemResolver } from '../categorisation/DrizzlePlannedItemResolver.js';
import { SuggestFromPlannedHintsUseCase } from '../../application/categorisation/SuggestFromPlannedHintsUseCase.js';
import { DrizzlePlannedHintReader } from '../categorisation/DrizzlePlannedHintReader.js';
import { SuggestFromMerchantRulesUseCase } from '../../application/categorisation/SuggestFromMerchantRulesUseCase.js';
import { DrizzleTransactionRepository } from '../transactions/DrizzleTransactionRepository.js';

/**
 * Worker-only: the bank-sync BullMQ processor and the 4-hourly scheduling cron.
 * Imported by WorkerModule only, never by the API module graph.
 */
@Module({
  imports: [BankModule, TransactionsModule, CategorisationModule],
  providers: [
    {
      provide: BankSyncSchedulerUseCase,
      inject: [DrizzleBankConnectionRepository],
      useFactory: (repo: DrizzleBankConnectionRepository) => new BankSyncSchedulerUseCase(repo),
    },
    {
      provide: SuggestFromMerchantRulesUseCase,
      inject: [DrizzleMerchantRuleRepository, DrizzlePlannedItemResolver],
      useFactory: (rules: DrizzleMerchantRuleRepository, items: DrizzlePlannedItemResolver) =>
        new SuggestFromMerchantRulesUseCase(rules, items),
    },
    {
      provide: SuggestFromPlannedHintsUseCase,
      inject: [DrizzlePlannedHintReader],
      useFactory: (hints: DrizzlePlannedHintReader) => new SuggestFromPlannedHintsUseCase(hints),
    },
    {
      provide: IngestBankTransactionsUseCase,
      inject: [
        DrizzleTransactionRepository,
        SuggestFromMerchantRulesUseCase,
        SuggestFromPlannedHintsUseCase,
      ],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        merchantRules: SuggestFromMerchantRulesUseCase,
        plannedHints: SuggestFromPlannedHintsUseCase,
      ) => new IngestBankTransactionsUseCase(txRepo, uuidv7, merchantRules, plannedHints),
    },
    {
      provide: BankSyncProcessor,
      inject: [
        DrizzleBankConnectionRepository,
        DrizzleBankAccountRepository,
        DrizzleSyncRunRepository,
        InMemoryBankConnectorRegistry,
        IngestBankTransactionsUseCase,
      ],
      useFactory: (
        connectionRepo: DrizzleBankConnectionRepository,
        bankAccountRepo: DrizzleBankAccountRepository,
        syncRunRepo: DrizzleSyncRunRepository,
        connectorRegistry: InMemoryBankConnectorRegistry,
        ingestUseCase: IngestBankTransactionsUseCase,
      ) =>
        new BankSyncProcessor(
          connectionRepo,
          bankAccountRepo,
          syncRunRepo,
          connectorRegistry,
          ingestUseCase,
        ),
    },
    {
      provide: BankSyncSchedulerService,
      inject: [BankSyncSchedulerUseCase, BullMQBankSyncQueue],
      useFactory: (schedulerUseCase: BankSyncSchedulerUseCase, syncQueue: BullMQBankSyncQueue) =>
        new BankSyncSchedulerService(schedulerUseCase, syncQueue),
    },
  ],
})
export class BankWorkerModule {}

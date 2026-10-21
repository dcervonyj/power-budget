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
import { DrizzleTransactionRepository } from '../transactions/DrizzleTransactionRepository.js';
import { DrizzleMappingRepository } from '../transactions/DrizzleMappingRepository.js';
import type { MappingSuggestionPort } from '../../domain/transactions/ports.js';

const STUB_SUGGESTION: MappingSuggestionPort = { suggest: () => null };

/**
 * Worker-only: the bank-sync BullMQ processor and the 4-hourly scheduling cron.
 * Imported by WorkerModule only, never by the API module graph.
 */
@Module({
  imports: [BankModule, TransactionsModule],
  providers: [
    {
      provide: BankSyncSchedulerUseCase,
      inject: [DrizzleBankConnectionRepository],
      useFactory: (repo: DrizzleBankConnectionRepository) => new BankSyncSchedulerUseCase(repo),
    },
    {
      provide: IngestBankTransactionsUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository],
      useFactory: (txRepo: DrizzleTransactionRepository, mappingRepo: DrizzleMappingRepository) =>
        new IngestBankTransactionsUseCase(txRepo, mappingRepo, STUB_SUGGESTION, uuidv7),
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

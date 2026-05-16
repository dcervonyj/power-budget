import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/AuthModule.js';
import { QueueModule } from '../queue/queue.module.js';
import { TransactionsModule } from '../transactions/TransactionsModule.js';
import { EnvKekEncryption } from '../auth/EnvKekEncryption.js';
import { DrizzleBankConnectionRepository } from './DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from './DrizzleBankAccountRepository.js';
import { InMemoryBankConnector } from './InMemoryBankConnector.js';
import { InMemoryBankConnectorRegistry } from './InMemoryBankConnectorRegistry.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';
import { WiseBankConnector } from './WiseBankConnector.js';
import { StubSyncRunRepository } from './StubSyncRunRepository.js';
import { DrizzleSyncRunRepository } from './DrizzleSyncRunRepository.js';
import { BullMQBankSyncQueue } from './BullMQBankSyncQueue.js';
import { BankSyncProcessor } from './BankSyncProcessor.js';
import { BankSyncSchedulerService } from './BankSyncSchedulerService.js';
import { BankSyncSchedulerUseCase } from '../../application/bank/use-cases/BankSyncSchedulerUseCase.js';
import { IngestBankTransactionsUseCase } from '../../application/transactions/use-cases/IngestBankTransactionsUseCase.js';
import { DrizzleTransactionRepository } from '../transactions/DrizzleTransactionRepository.js';
import { DrizzleMappingRepository } from '../transactions/DrizzleMappingRepository.js';
import { uuidv7 } from 'uuidv7';
import type { MappingSuggestionPort } from '../../domain/transactions/ports.js';

const STUB_SUGGESTION: MappingSuggestionPort = { suggest: () => null };

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    AuthModule,
    QueueModule,
    TransactionsModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    StubSyncRunRepository,
    DrizzleSyncRunRepository,
    BullMQBankSyncQueue,
    {
      provide: InMemoryBankConnectorRegistry,
      inject: [ConfigService, EnvKekEncryption],
      useFactory: (config: ConfigService, encryption: EnvKekEncryption) => {
        const registry = new InMemoryBankConnectorRegistry();
        registry.register(new InMemoryBankConnector());
        registry.register(
          new WiseBankConnector(
            encryption,
            config.get<string>('WISE_API_BASE_URL') ?? 'https://api.wise.com',
          ),
        );

        const secretId = config.get<string>('GOCARDLESS_SECRET_ID') ?? '';
        const secretKey = config.get<string>('GOCARDLESS_SECRET_KEY') ?? '';

        if (secretId && secretKey) {
          registry.register(new GoCardlessBankConnector(secretId, secretKey, encryption));
        }

        return registry;
      },
    },
    {
      provide: BankSyncSchedulerUseCase,
      inject: [DrizzleBankConnectionRepository],
      useFactory: (repo: DrizzleBankConnectionRepository) => new BankSyncSchedulerUseCase(repo),
    },
    {
      provide: IngestBankTransactionsUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
      ) => new IngestBankTransactionsUseCase(txRepo, mappingRepo, STUB_SUGGESTION, uuidv7),
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
      useFactory: (
        schedulerUseCase: BankSyncSchedulerUseCase,
        syncQueue: BullMQBankSyncQueue,
      ) => new BankSyncSchedulerService(schedulerUseCase, syncQueue),
    },
  ],
  exports: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    StubSyncRunRepository,
    DrizzleSyncRunRepository,
    BullMQBankSyncQueue,
    InMemoryBankConnectorRegistry,
  ],
})
export class BankModule {}

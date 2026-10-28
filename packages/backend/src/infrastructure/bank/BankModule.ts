import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/AuthModule.js';
import { QueueModule } from '../queue/queue.module.js';
import { EnvKekEncryption } from '../auth/EnvKekEncryption.js';
import { DrizzleBankConnectionRepository } from './DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from './DrizzleBankAccountRepository.js';
import { DrizzleAccountRepository } from './DrizzleAccountRepository.js';
import { InMemoryBankConnector } from './InMemoryBankConnector.js';
import { InMemoryBankConnectorRegistry } from './InMemoryBankConnectorRegistry.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';
import { WiseBankConnector } from './WiseBankConnector.js';
import { StubSyncRunRepository } from './StubSyncRunRepository.js';
import { DrizzleSyncRunRepository } from './DrizzleSyncRunRepository.js';
import { BullMQBankSyncQueue } from './BullMQBankSyncQueue.js';
import { RedisBankCatalogCache } from './RedisBankCatalogCache.js';

/**
 * Bank adapters shared by the API and the worker: repositories, the connector
 * registry and the bank-sync queue producer. The sync processor and the
 * scheduling cron live in BankWorkerModule, which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, AuthModule, QueueModule],
  providers: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    DrizzleAccountRepository,
    StubSyncRunRepository,
    DrizzleSyncRunRepository,
    BullMQBankSyncQueue,
    RedisBankCatalogCache,
    {
      provide: InMemoryBankConnectorRegistry,
      inject: [APP_CONFIG, EnvKekEncryption],
      useFactory: (config: AppConfig, encryption: EnvKekEncryption) => {
        const registry = new InMemoryBankConnectorRegistry();
        registry.register(new InMemoryBankConnector());
        registry.register(new WiseBankConnector(encryption, config.wiseApiBaseUrl));

        // GoCardless is legacy and optional (removed with BNK-008).
        const { gocardlessSecretId, gocardlessSecretKey } = config;
        if (gocardlessSecretId && gocardlessSecretKey) {
          registry.register(
            new GoCardlessBankConnector(gocardlessSecretId, gocardlessSecretKey, encryption),
          );
        }

        return registry;
      },
    },
  ],
  exports: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    DrizzleAccountRepository,
    StubSyncRunRepository,
    DrizzleSyncRunRepository,
    BullMQBankSyncQueue,
    RedisBankCatalogCache,
    InMemoryBankConnectorRegistry,
  ],
})
export class BankModule {}

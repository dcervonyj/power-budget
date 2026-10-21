import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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

/**
 * Bank adapters shared by the API and the worker: repositories, the connector
 * registry and the bank-sync queue producer. The sync processor and the
 * scheduling cron live in BankWorkerModule, which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, ConfigModule, AuthModule, QueueModule],
  providers: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    DrizzleAccountRepository,
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
  ],
  exports: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    DrizzleAccountRepository,
    StubSyncRunRepository,
    DrizzleSyncRunRepository,
    BullMQBankSyncQueue,
    InMemoryBankConnectorRegistry,
  ],
})
export class BankModule {}

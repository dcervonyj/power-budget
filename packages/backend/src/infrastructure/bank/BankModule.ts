import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/AuthModule.js';
import { EnvKekEncryption } from '../auth/EnvKekEncryption.js';
import { DrizzleBankConnectionRepository } from './DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from './DrizzleBankAccountRepository.js';
import { InMemoryBankConnector } from './InMemoryBankConnector.js';
import { InMemoryBankConnectorRegistry } from './InMemoryBankConnectorRegistry.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';
import { WiseBankConnector } from './WiseBankConnector.js';
import { StubSyncRunRepository } from './StubSyncRunRepository.js';

@Module({
  imports: [DatabaseModule, ConfigModule, AuthModule],
  providers: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    StubSyncRunRepository,
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
    StubSyncRunRepository,
    InMemoryBankConnectorRegistry,
  ],
})
export class BankModule {}

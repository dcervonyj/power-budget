import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleBankConnectionRepository } from './DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from './DrizzleBankAccountRepository.js';
import { InMemoryBankConnector } from './InMemoryBankConnector.js';
import { InMemoryBankConnectorRegistry } from './InMemoryBankConnectorRegistry.js';
import { StubSyncRunRepository } from './StubSyncRunRepository.js';

const registry = new InMemoryBankConnectorRegistry();
registry.register(new InMemoryBankConnector());

@Module({
  imports: [DatabaseModule],
  providers: [
    DrizzleBankConnectionRepository,
    DrizzleBankAccountRepository,
    StubSyncRunRepository,
    {
      provide: InMemoryBankConnectorRegistry,
      useValue: registry,
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

import { Module } from '@nestjs/common';
import { SystemModule, CLOCK, ID_GENERATOR } from '../../infrastructure/system/SystemModule.js';
import type { Clock, IdGenerator } from '../../domain/shared/ports.js';
import { BankModule } from '../../infrastructure/bank/BankModule.js';
import { AuditModule, REDACTING_AUDIT_LOGGER } from '../../infrastructure/audit/AuditModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from '../../infrastructure/bank/DrizzleBankAccountRepository.js';
import { InMemoryBankConnectorRegistry } from '../../infrastructure/bank/InMemoryBankConnectorRegistry.js';
import type { AuditLogger } from '../../domain/audit/ports.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { BullMQBankSyncQueue } from '../../infrastructure/bank/BullMQBankSyncQueue.js';
import { RedisBankCatalogCache } from '../../infrastructure/bank/RedisBankCatalogCache.js';
import { InitiateBankConnectionUseCase } from '../../application/bank/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../../application/bank/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../../application/bank/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../application/bank/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../application/bank/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../../application/bank/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../../application/bank/use-cases/GetBankCatalogUseCase.js';
import { ListConnectionAccountsUseCase } from '../../application/bank/use-cases/ListConnectionAccountsUseCase.js';
import { ListAccountsUseCase } from '../../application/bank/use-cases/ListAccountsUseCase.js';
import { CreateManualAccountUseCase } from '../../application/bank/use-cases/CreateManualAccountUseCase.js';
import { DrizzleAccountRepository } from '../../infrastructure/bank/DrizzleAccountRepository.js';
import { BankController } from './BankController.js';
import { AccountsController } from './AccountsController.js';

@Module({
  imports: [BankModule, AuditModule, AuthModule, SystemModule],
  controllers: [BankController, AccountsController],
  providers: [
    {
      provide: InitiateBankConnectionUseCase,
      inject: [
        DrizzleBankConnectionRepository,
        InMemoryBankConnectorRegistry,
        DrizzleTotpSecretRepository,
        ID_GENERATOR,
      ],
      useFactory: (
        repo: DrizzleBankConnectionRepository,
        reg: InMemoryBankConnectorRegistry,
        totpRepo: DrizzleTotpSecretRepository,
        ids: IdGenerator,
      ) => new InitiateBankConnectionUseCase(repo, reg, totpRepo, ids),
    },
    {
      provide: CompleteBankConsentUseCase,
      inject: [DrizzleBankConnectionRepository, InMemoryBankConnectorRegistry],
      useFactory: (repo: DrizzleBankConnectionRepository, reg: InMemoryBankConnectorRegistry) =>
        new CompleteBankConsentUseCase(repo, reg),
    },
    {
      provide: ListUserConnectionsUseCase,
      inject: [DrizzleBankConnectionRepository],
      useFactory: (repo: DrizzleBankConnectionRepository) => new ListUserConnectionsUseCase(repo),
    },
    {
      provide: RefreshConnectionUseCase,
      inject: [DrizzleBankConnectionRepository, BullMQBankSyncQueue],
      useFactory: (repo: DrizzleBankConnectionRepository, queue: BullMQBankSyncQueue) =>
        new RefreshConnectionUseCase(repo, queue),
    },
    {
      provide: DisconnectBankUseCase,
      inject: [
        DrizzleBankConnectionRepository,
        InMemoryBankConnectorRegistry,
        REDACTING_AUDIT_LOGGER,
        CLOCK,
      ],
      useFactory: (
        repo: DrizzleBankConnectionRepository,
        reg: InMemoryBankConnectorRegistry,
        audit: AuditLogger,
        clock: Clock,
      ) => new DisconnectBankUseCase(repo, reg, audit, clock),
    },
    {
      provide: ReconnectBankUseCase,
      inject: [DrizzleBankConnectionRepository, InMemoryBankConnectorRegistry],
      useFactory: (repo: DrizzleBankConnectionRepository, reg: InMemoryBankConnectorRegistry) =>
        new ReconnectBankUseCase(repo, reg),
    },
    {
      provide: GetBankCatalogUseCase,
      inject: [InMemoryBankConnectorRegistry, RedisBankCatalogCache],
      useFactory: (reg: InMemoryBankConnectorRegistry, cache: RedisBankCatalogCache) =>
        new GetBankCatalogUseCase(reg, cache),
    },
    {
      provide: ListConnectionAccountsUseCase,
      inject: [DrizzleBankConnectionRepository, DrizzleBankAccountRepository],
      useFactory: (
        connectionRepo: DrizzleBankConnectionRepository,
        accountRepo: DrizzleBankAccountRepository,
      ) => new ListConnectionAccountsUseCase(connectionRepo, accountRepo),
    },
    {
      provide: ListAccountsUseCase,
      inject: [DrizzleAccountRepository],
      useFactory: (repo: DrizzleAccountRepository) => new ListAccountsUseCase(repo),
    },
    {
      provide: CreateManualAccountUseCase,
      inject: [DrizzleAccountRepository, ID_GENERATOR],
      useFactory: (repo: DrizzleAccountRepository, ids: IdGenerator) =>
        new CreateManualAccountUseCase(repo, ids),
    },
  ],
})
export class BankPresentationModule {}

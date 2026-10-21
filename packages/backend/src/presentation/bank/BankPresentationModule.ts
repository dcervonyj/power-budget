import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankModule } from '../../infrastructure/bank/BankModule.js';
import { AuditModule, REDACTING_AUDIT_LOGGER } from '../../infrastructure/audit/AuditModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import { DrizzleBankAccountRepository } from '../../infrastructure/bank/DrizzleBankAccountRepository.js';
import { InMemoryBankConnectorRegistry } from '../../infrastructure/bank/InMemoryBankConnectorRegistry.js';
import type { AuditLogger } from '../../domain/audit/ports.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { BullMQBankSyncQueue } from '../../infrastructure/bank/BullMQBankSyncQueue.js';
import { InitiateBankConnectionUseCase } from '../../application/bank/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../../application/bank/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../../application/bank/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../application/bank/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../application/bank/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../../application/bank/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../../application/bank/use-cases/GetBankCatalogUseCase.js';
import { ListConnectionAccountsUseCase } from '../../application/bank/use-cases/ListConnectionAccountsUseCase.js';
import { BankController } from './BankController.js';

@Module({
  imports: [BankModule, AuditModule, AuthModule, ConfigModule],
  controllers: [BankController],
  providers: [
    {
      provide: InitiateBankConnectionUseCase,
      inject: [
        DrizzleBankConnectionRepository,
        InMemoryBankConnectorRegistry,
        DrizzleTotpSecretRepository,
      ],
      useFactory: (
        repo: DrizzleBankConnectionRepository,
        reg: InMemoryBankConnectorRegistry,
        totpRepo: DrizzleTotpSecretRepository,
      ) => new InitiateBankConnectionUseCase(repo, reg, totpRepo),
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
      ],
      useFactory: (
        repo: DrizzleBankConnectionRepository,
        reg: InMemoryBankConnectorRegistry,
        audit: AuditLogger,
      ) => new DisconnectBankUseCase(repo, reg, audit),
    },
    {
      provide: ReconnectBankUseCase,
      inject: [DrizzleBankConnectionRepository, InMemoryBankConnectorRegistry],
      useFactory: (repo: DrizzleBankConnectionRepository, reg: InMemoryBankConnectorRegistry) =>
        new ReconnectBankUseCase(repo, reg),
    },
    {
      provide: GetBankCatalogUseCase,
      inject: [InMemoryBankConnectorRegistry],
      useFactory: (reg: InMemoryBankConnectorRegistry) => new GetBankCatalogUseCase(reg),
    },
    {
      provide: ListConnectionAccountsUseCase,
      inject: [DrizzleBankAccountRepository],
      useFactory: (repo: DrizzleBankAccountRepository) => new ListConnectionAccountsUseCase(repo),
    },
  ],
})
export class BankPresentationModule {}

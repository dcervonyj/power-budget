import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankModule } from '../infrastructure/BankModule.js';
import { AuditModule } from '../../audit/infrastructure/AuditModule.js';
import { AuthModule } from '../../auth/infrastructure/AuthModule.js';
import { DrizzleBankConnectionRepository } from '../infrastructure/DrizzleBankConnectionRepository.js';
import { InMemoryBankConnectorRegistry } from '../infrastructure/InMemoryBankConnectorRegistry.js';
import { DrizzleAuditEventRepository } from '../../audit/infrastructure/DrizzleAuditEventRepository.js';
import { DrizzleTotpSecretRepository } from '../../auth/infrastructure/DrizzleTotpSecretRepository.js';
import { BullMQBankSyncQueue } from '../infrastructure/BullMQBankSyncQueue.js';
import { InitiateBankConnectionUseCase } from '../application/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../application/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../application/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../application/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../application/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../application/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../application/use-cases/GetBankCatalogUseCase.js';
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
        DrizzleAuditEventRepository,
      ],
      useFactory: (
        repo: DrizzleBankConnectionRepository,
        reg: InMemoryBankConnectorRegistry,
        audit: DrizzleAuditEventRepository,
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
  ],
})
export class BankPresentationModule {}

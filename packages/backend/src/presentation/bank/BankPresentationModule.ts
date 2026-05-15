import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankModule } from '../../infrastructure/bank/BankModule.js';
import { AuditModule } from '../../infrastructure/audit/AuditModule.js';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { DrizzleBankConnectionRepository } from '../../infrastructure/bank/DrizzleBankConnectionRepository.js';
import { InMemoryBankConnectorRegistry } from '../../infrastructure/bank/InMemoryBankConnectorRegistry.js';
import { DrizzleAuditEventRepository } from '../../infrastructure/audit/DrizzleAuditEventRepository.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { InitiateBankConnectionUseCase } from '../../application/bank/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../../application/bank/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../../application/bank/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../application/bank/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../application/bank/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../../application/bank/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../../application/bank/use-cases/GetBankCatalogUseCase.js';
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
      inject: [DrizzleBankConnectionRepository],
      useFactory: (repo: DrizzleBankConnectionRepository) => new RefreshConnectionUseCase(repo),
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

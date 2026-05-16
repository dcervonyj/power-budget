import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { uuidv7 } from 'uuidv7';
import { TransactionsModule } from '../infrastructure/TransactionsModule.js';
import { DrizzleMappingRepository } from '../infrastructure/DrizzleMappingRepository.js';
import { DrizzleTransactionRepository } from '../infrastructure/DrizzleTransactionRepository.js';
import { DrizzleTransferRepository } from '../infrastructure/DrizzleTransferRepository.js';
import { AddManualTransactionUseCase } from '../application/use-cases/AddManualTransactionUseCase.js';
import { BulkMapTransactionsUseCase } from '../application/use-cases/BulkMapTransactionsUseCase.js';
import { GetTransactionUseCase } from '../application/use-cases/GetTransactionUseCase.js';
import { ListTransactionsUseCase } from '../application/use-cases/ListTransactionsUseCase.js';
import { MapTransactionUseCase } from '../application/use-cases/MapTransactionUseCase.js';
import { MarkAsTransferUseCase } from '../application/use-cases/MarkAsTransferUseCase.js';
import { PatchTransactionUseCase } from '../application/use-cases/PatchTransactionUseCase.js';
import { UnmarkTransferUseCase } from '../application/use-cases/UnmarkTransferUseCase.js';
import type { PlanActualsRefreshPort } from '../domain/ports.js';
import { TransactionsController } from './TransactionsController.js';

const STUB_REFRESH_PORT: PlanActualsRefreshPort = {
  scheduleRefresh: async () => undefined,
};

@Module({
  imports: [TransactionsModule, ConfigModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: ListTransactionsUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) => new ListTransactionsUseCase(txRepo),
    },
    {
      provide: GetTransactionUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
      ) => new GetTransactionUseCase(txRepo, mappingRepo, transferRepo),
    },
    {
      provide: AddManualTransactionUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) =>
        new AddManualTransactionUseCase(txRepo, uuidv7),
    },
    {
      provide: MapTransactionUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
      ) => new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, STUB_REFRESH_PORT),
    },
    {
      provide: BulkMapTransactionsUseCase,
      inject: [DrizzleMappingRepository],
      useFactory: (mappingRepo: DrizzleMappingRepository) =>
        new BulkMapTransactionsUseCase(mappingRepo, STUB_REFRESH_PORT),
    },
    {
      provide: MarkAsTransferUseCase,
      inject: [DrizzleTransactionRepository, DrizzleMappingRepository, DrizzleTransferRepository],
      useFactory: (
        txRepo: DrizzleTransactionRepository,
        mappingRepo: DrizzleMappingRepository,
        transferRepo: DrizzleTransferRepository,
      ) => new MarkAsTransferUseCase(txRepo, mappingRepo, transferRepo),
    },
    {
      provide: UnmarkTransferUseCase,
      inject: [DrizzleTransactionRepository, DrizzleTransferRepository],
      useFactory: (txRepo: DrizzleTransactionRepository, transferRepo: DrizzleTransferRepository) =>
        new UnmarkTransferUseCase(txRepo, transferRepo),
    },
    {
      provide: PatchTransactionUseCase,
      inject: [DrizzleTransactionRepository],
      useFactory: (txRepo: DrizzleTransactionRepository) => new PatchTransactionUseCase(txRepo),
    },
  ],
})
export class TransactionsPresentationModule {}

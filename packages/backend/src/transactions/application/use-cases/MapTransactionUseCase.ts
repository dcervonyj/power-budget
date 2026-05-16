import type { TransactionId, PlannedItemId, UserId, HouseholdId, PlanId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
  PlanActualsRefreshPort,
} from '../../domain/ports.js';
import { TransactionNotFoundError, AlreadyTransferError } from '../../domain/errors.js';
import type { MapTransactionInput } from '../models/index.js';
export type { MapTransactionInput };

export class MapTransactionUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
    private readonly transferRepo: TransferRepository,
    private readonly refreshPort: PlanActualsRefreshPort,
  ) {}

  async execute(input: MapTransactionInput): Promise<void> {
    const tx = await this.transactionRepo.findById(input.transactionId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    const transfer = await this.transferRepo.findByTransaction(input.transactionId);
    if (transfer !== null) {
      throw new AlreadyTransferError();
    }

    await this.mappingRepo.set(input.transactionId, input.plannedItemId, input.by);
    await this.refreshPort.scheduleRefresh(input.planId);
  }
}

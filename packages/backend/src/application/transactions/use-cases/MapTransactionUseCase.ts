import type { TransactionId, PlannedItemId, UserId, HouseholdId, PlanId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
  PlanActualsRefreshPort,
} from '../../../domain/transactions/ports.js';
import {
  TransactionNotFoundError,
  AlreadyTransferError,
} from '../../../domain/transactions/errors.js';

export interface MapTransactionInput {
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId | null;
  readonly by: UserId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
}

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

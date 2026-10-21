import type { TransactionId, UserId, HouseholdId } from '@power-budget/core';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../domain/transactions/ports.js';
import {
  TransactionNotFoundError,
  AlreadyMappedError,
} from '../../../domain/transactions/errors.js';

export interface MarkAsTransferInput {
  readonly transactionId: TransactionId;
  readonly counterpartId: TransactionId | null;
  readonly by: UserId;
  readonly householdId: HouseholdId;
}

export class MarkAsTransferUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(input: MarkAsTransferInput): Promise<void> {
    // Transfers move money between the caller's own accounts: both sides must be theirs.
    const tx = await this.transactionRepo.findOwnedById(input.transactionId, input.by, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    const scope = { householdId: input.householdId };
    if (input.counterpartId !== null) {
      const counterpart = await this.transactionRepo.findOwnedById(
        input.counterpartId,
        input.by,
        scope,
      );
      if (counterpart === null) {
        throw new TransactionNotFoundError();
      }
    }

    const existingMapping = await this.mappingRepo.findByTransaction(input.transactionId, scope);
    if (existingMapping !== null) {
      throw new AlreadyMappedError();
    }

    await this.transferRepo.mark(input.transactionId, input.counterpartId, input.by, scope);
  }
}

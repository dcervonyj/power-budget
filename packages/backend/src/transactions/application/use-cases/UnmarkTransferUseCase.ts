import type { TransactionId, HouseholdId } from '@power-budget/core';
import type { TransactionRepository, TransferRepository } from '../../domain/ports.js';
import { TransactionNotFoundError } from '../../domain/errors.js';
import type { UnmarkTransferInput } from '../models/index.js';
export type { UnmarkTransferInput };

export class UnmarkTransferUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(input: UnmarkTransferInput): Promise<void> {
    const tx = await this.transactionRepo.findById(input.transactionId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    await this.transferRepo.unmark(input.transactionId);
  }
}

import type { TransactionId, HouseholdId, UserId } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/transactions/ports.js';
import type { Transaction } from '../../../domain/transactions/entities.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';

export interface PatchTransactionInput {
  readonly transactionId: TransactionId;
  readonly householdId: HouseholdId;
  /** Only the account owner edits a transaction; a partner's reads as not found. */
  readonly userId: UserId;
  readonly patch: Partial<Pick<Transaction, 'notes' | 'ignored'>>;
}

export class PatchTransactionUseCase {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(input: PatchTransactionInput): Promise<void> {
    const tx = await this.transactionRepo.findOwnedById(input.transactionId, input.userId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    await this.transactionRepo.patch(input.transactionId, input.patch, {
      householdId: input.householdId,
    });
  }
}

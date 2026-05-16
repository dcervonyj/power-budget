import type { TransactionId, HouseholdId } from '@power-budget/core';
import type { TransactionRepository } from '../../domain/ports.js';
import type { Transaction } from '../../domain/entities.js';
import { TransactionNotFoundError } from '../../domain/errors.js';
import type { PatchTransactionInput } from '../models/index.js';
export type { PatchTransactionInput };

export class PatchTransactionUseCase {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(input: PatchTransactionInput): Promise<void> {
    const tx = await this.transactionRepo.findById(input.transactionId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    await this.transactionRepo.patch(input.transactionId, input.patch);
  }
}

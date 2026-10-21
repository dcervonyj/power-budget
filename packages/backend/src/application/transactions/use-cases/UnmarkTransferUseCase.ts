import type { TransactionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  TransactionRepository,
  TransferRepository,
} from '../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';

export interface UnmarkTransferInput {
  readonly transactionId: TransactionId;
  readonly householdId: HouseholdId;
  /** Only the account owner unmarks; a partner's transaction reads as not found. */
  readonly userId: UserId;
}

export class UnmarkTransferUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(input: UnmarkTransferInput): Promise<void> {
    const tx = await this.transactionRepo.findOwnedById(input.transactionId, input.userId, {
      householdId: input.householdId,
    });
    if (tx === null) {
      throw new TransactionNotFoundError();
    }

    await this.transferRepo.unmark(input.transactionId, { householdId: input.householdId });
  }
}

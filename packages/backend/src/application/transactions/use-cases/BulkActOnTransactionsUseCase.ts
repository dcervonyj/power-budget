import type { HouseholdId, TransactionId, UserId } from '@power-budget/core';
import type {
  TransactionRepository,
  TransferRepository,
} from '../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';

export type BulkTransactionAction = 'transfer' | 'ignore';

export interface BulkActOnTransactionsInput {
  readonly action: BulkTransactionAction;
  readonly transactionIds: ReadonlyArray<TransactionId>;
  readonly by: UserId;
  readonly householdId: HouseholdId;
}

/**
 * `POST /transactions/bulk` with `op: 'transfer' | 'ignore'`. All or nothing: one id that is
 * not on the caller's own accounts (a partner's, another household's, unknown) rejects the
 * batch before anything is written; the write itself is one statement or one transaction.
 */
export class BulkActOnTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly transferRepo: TransferRepository,
  ) {}

  async execute(input: BulkActOnTransactionsInput): Promise<void> {
    const ids = [...new Set(input.transactionIds)];
    if (ids.length === 0) {
      return;
    }

    const scope = { householdId: input.householdId };
    const owned = await this.transactionRepo.findOwnedIds(ids, input.by, scope);
    if (owned.length !== ids.length) {
      throw new TransactionNotFoundError();
    }

    switch (input.action) {
      case 'transfer':
        // A mapped transaction rejects the batch (ALREADY_MAPPED), as for one transaction.
        await this.transferRepo.bulkMarkStandalone(ids, input.by, scope);

        return;
      case 'ignore':
        await this.transactionRepo.setIgnored(ids, true, scope);

        return;
    }
  }
}

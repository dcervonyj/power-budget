import type { TransactionId, PlannedItemId, UserId, PlanId, HouseholdId } from '@power-budget/core';
import type {
  MappingRepository,
  TransactionRepository,
} from '../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';

export interface BulkMapTransactionsInput {
  readonly mappings: ReadonlyArray<{ transactionId: TransactionId; plannedItemId: PlannedItemId }>;
  readonly by: UserId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
}

export class BulkMapTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
  ) {}

  /**
   * All or nothing: one transaction that is not on the caller's own accounts (a partner's,
   * another household's, unknown) rejects the whole batch before anything is written.
   */
  async execute(input: BulkMapTransactionsInput): Promise<void> {
    if (input.mappings.length === 0) {
      return;
    }

    const scope = { householdId: input.householdId };
    const ids = [...new Set(input.mappings.map((m) => m.transactionId))];
    const owned = await this.transactionRepo.findOwnedIds(ids, input.by, scope);
    if (owned.length !== ids.length) {
      throw new TransactionNotFoundError();
    }

    // The repository also rejects the whole batch if any planned item is foreign.
    await this.mappingRepo.bulkSet([...input.mappings], input.by, scope);
  }
}

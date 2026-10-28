import {
  PlannedItemId,
  type TransactionId,
  type UserId,
  type PlanId,
  type HouseholdId,
} from '@power-budget/core';
import type {
  MappingRepository,
  TransactionRepository,
} from '../../../domain/transactions/ports.js';
import type { LearnMerchantRuleUseCase } from '../../categorisation/LearnMerchantRuleUseCase.js';
import {
  PlannedItemNotFoundError,
  TransactionNotFoundError,
} from '../../../domain/transactions/errors.js';

export interface BulkMapTransactionsInput {
  /** The planned item id is raw: it is branded after the ownership check, which answers first. */
  readonly mappings: ReadonlyArray<{ transactionId: TransactionId; plannedItemId: string }>;
  readonly by: UserId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
}

export class BulkMapTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly mappingRepo: MappingRepository,
    private readonly merchantMemory: LearnMerchantRuleUseCase,
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

    const mappings = input.mappings.map((m) => ({
      transactionId: m.transactionId,
      plannedItemId: this.plannedItemIdOf(m.plannedItemId),
    }));
    // The repository also rejects the whole batch if any planned item is foreign.
    await this.mappingRepo.bulkSet(mappings, input.by, scope);
    for (const mapping of mappings) {
      await this.learn(mapping, input, scope);
    }
  }

  private plannedItemIdOf(raw: string): PlannedItemId {
    if (!PlannedItemId.isValid(raw)) {
      throw new PlannedItemNotFoundError();
    }

    return PlannedItemId.of(raw);
  }

  private async learn(
    mapping: { transactionId: TransactionId; plannedItemId: PlannedItemId },
    input: BulkMapTransactionsInput,
    scope: { householdId: HouseholdId },
  ): Promise<void> {
    try {
      const transaction = await this.transactionRepo.findById(mapping.transactionId, scope);
      if (transaction === null) {
        return;
      }
      await this.merchantMemory.learnFromMapping({
        transaction,
        plannedItemId: mapping.plannedItemId,
        by: input.by,
        householdId: input.householdId,
      });
    } catch {
      // The mappings are already saved (each statement commits on its own); the rule for this
      // row is simply not learned. The rule write itself is logged by learnFromMapping.
    }
  }
}

import type { TransactionId, PlannedItemId, UserId, PlanId, HouseholdId } from '@power-budget/core';
import type {
  MappingRepository,
  PlanActualsRefreshPort,
} from '../../../domain/transactions/ports.js';

export interface BulkMapTransactionsInput {
  readonly mappings: ReadonlyArray<{ transactionId: TransactionId; plannedItemId: PlannedItemId }>;
  readonly by: UserId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
}

export class BulkMapTransactionsUseCase {
  constructor(
    private readonly mappingRepo: MappingRepository,
    private readonly refreshPort: PlanActualsRefreshPort,
  ) {}

  async execute(input: BulkMapTransactionsInput): Promise<void> {
    if (input.mappings.length === 0) {
      return;
    }

    // The repository rejects the whole batch if any transaction or planned item is foreign.
    await this.mappingRepo.bulkSet([...input.mappings], input.by, {
      householdId: input.householdId,
    });
    await this.refreshPort.scheduleRefresh(input.planId);
  }
}

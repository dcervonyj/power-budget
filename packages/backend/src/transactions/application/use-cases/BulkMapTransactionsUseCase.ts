import type { TransactionId, PlannedItemId, UserId, PlanId } from '@power-budget/core';
import type { MappingRepository, PlanActualsRefreshPort } from '../../domain/ports.js';

export interface BulkMapTransactionsInput {
  readonly mappings: ReadonlyArray<{ transactionId: TransactionId; plannedItemId: PlannedItemId }>;
  readonly by: UserId;
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

    await this.mappingRepo.bulkSet([...input.mappings], input.by);
    await this.refreshPort.scheduleRefresh(input.planId);
  }
}

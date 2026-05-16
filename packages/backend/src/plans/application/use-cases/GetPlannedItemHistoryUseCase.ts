import type { PlannedItemId } from '@power-budget/core';
import type { PlannedItemVersion } from '../../domain/entities.js';
import type { PlannedItemVersionRepository } from '../../domain/ports.js';

export interface GetPlannedItemHistoryInput {
  readonly itemId: PlannedItemId;
}

export class GetPlannedItemHistoryUseCase {
  constructor(private readonly versionRepo: PlannedItemVersionRepository) {}

  execute(input: GetPlannedItemHistoryInput): Promise<PlannedItemVersion[]> {
    return this.versionRepo.listByItem(input.itemId);
  }
}

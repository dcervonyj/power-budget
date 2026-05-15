import { describe, it, expect, vi } from 'vitest';
import type { IsoDateTime } from '@power-budget/core';
import { PlannedItemId } from '@power-budget/core';
import type { PlannedItemVersion } from '../../../domain/plans/entities.js';
import type { PlannedItemVersionRepository } from '../../../domain/plans/ports.js';
import { GetPlannedItemHistoryUseCase } from './GetPlannedItemHistoryUseCase.js';

const ITEM_ID = PlannedItemId.of('01900000-0000-7000-8000-000000000001');

function makeVersion(): PlannedItemVersion {
  return {
    id: '01900000-0000-7000-8000-000000000010' as PlannedItemVersion['id'],
    plannedItemId: ITEM_ID,
    householdId: 'hh-1' as PlannedItemVersion['householdId'],
    before: null,
    after: { amount: { amountMinor: 5000n, currency: 'PLN' } },
    changedBy: 'u-1' as PlannedItemVersion['changedBy'],
    changedAt: '2024-01-10T00:00:00Z' as IsoDateTime,
    reason: null,
  };
}

describe('GetPlannedItemHistoryUseCase', () => {
  it('returns version history for the item', async () => {
    const versions = [makeVersion()];
    const versionRepo: PlannedItemVersionRepository = {
      append: vi.fn(),
      listByItem: vi.fn().mockResolvedValue(versions),
    };

    const useCase = new GetPlannedItemHistoryUseCase(versionRepo);
    const result = await useCase.execute({ itemId: ITEM_ID });

    expect(result).toBe(versions);
    expect(versionRepo.listByItem).toHaveBeenCalledWith(ITEM_ID);
  });

  it('returns empty array when no history exists', async () => {
    const versionRepo: PlannedItemVersionRepository = {
      append: vi.fn(),
      listByItem: vi.fn().mockResolvedValue([]),
    };

    const useCase = new GetPlannedItemHistoryUseCase(versionRepo);
    const result = await useCase.execute({ itemId: ITEM_ID });

    expect(result).toEqual([]);
  });
});

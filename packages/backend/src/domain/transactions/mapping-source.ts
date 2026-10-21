import type { PlannedItemId } from '@power-budget/core';
import type { MappingOrigin, MappingSource } from './entities.js';

/**
 * The list's `mappingSource`: the origin of the stored mapping, else `suggestion` when a
 * suggested planned item waits for confirmation, else `none`.
 */
export function mappingSourceOf(
  origin: MappingOrigin | null,
  suggestedPlannedItemId: PlannedItemId | null,
): MappingSource {
  if (origin !== null) {
    return origin;
  }

  return suggestedPlannedItemId !== null ? 'suggestion' : 'none';
}

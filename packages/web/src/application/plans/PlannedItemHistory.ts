import type { MoneyDto, PlannedItemVersionDto } from '@power-budget/shared-app/contract';

/** Edits by the same user this close together are shown as one change. */
const ROLLUP_WINDOW_MS = 60_000;

/** One changed field of a planned-item version (`PlannedItemChangeDto`); undefined = not set. */
export type PlannedItemFieldChange =
  | { readonly field: 'amount'; readonly before?: MoneyDto; readonly after?: MoneyDto }
  | { readonly field: 'note'; readonly before?: string | null; readonly after?: string | null };

/**
 * Rolls up consecutive versions by the same user within a minute. The API lists
 * versions newest first; a rolled-up entry keeps the newest time, reason and `after`
 * values and the oldest `before` values.
 */
export function rollUpPlannedItemHistory(
  versions: readonly PlannedItemVersionDto[],
): PlannedItemVersionDto[] {
  const result: PlannedItemVersionDto[] = [];
  for (const version of versions) {
    const newer = result[result.length - 1];
    if (newer !== undefined && isSameEdit(newer, version)) {
      result[result.length - 1] = merge(newer, version);
    } else {
      result.push(version);
    }
  }

  return result;
}

/** The fields a version changed, in a fixed order (amount, then note). */
export function changedFields(version: PlannedItemVersionDto): PlannedItemFieldChange[] {
  const before = version.before ?? {};
  const { after } = version;
  const changes: PlannedItemFieldChange[] = [];
  if (after.amount !== undefined) {
    changes.push({ field: 'amount', before: before.amount, after: after.amount });
  }
  if ('note' in after) {
    changes.push({ field: 'note', before: before.note, after: after.note });
  }

  return changes;
}

function isSameEdit(newer: PlannedItemVersionDto, older: PlannedItemVersionDto): boolean {
  const gap = Date.parse(newer.changedAt) - Date.parse(older.changedAt);

  return newer.changedBy === older.changedBy && Math.abs(gap) <= ROLLUP_WINDOW_MS;
}

function merge(newer: PlannedItemVersionDto, older: PlannedItemVersionDto): PlannedItemVersionDto {
  const before = older.before === null ? newer.before : { ...newer.before, ...older.before };

  return {
    ...newer,
    before,
    after: { ...older.after, ...newer.after },
    reason: newer.reason ?? older.reason,
  };
}

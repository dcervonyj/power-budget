import { parseMinorUnits } from '@power-budget/core';
import type { MinorUnitAmount } from '@power-budget/core';
import type { TxRowData } from '@power-budget/shared-app';
import type {
  PlanDashboardResponseDto,
  TransactionListItemDto,
} from '@power-budget/shared-app/contract';

export type RowKind = 'toSort' | 'sorted' | 'transfer';
export type ListFilter = 'all' | 'toSort' | 'sorted' | 'transfers';
export type RowProvenance = 'bank' | 'manual' | 'rule';
export type RodState = 'under' | 'over' | 'empty';

/** One transaction of the mobile list, ready for `TxRow`. */
export interface TransactionListRow {
  readonly data: TxRowData;
  /** Calendar day, 'YYYY-MM-DD'. */
  readonly day: string;
  readonly kind: RowKind;
  /** A booked row that just arrived from the bank. */
  readonly live: boolean;
  readonly provenance?: RowProvenance;
  /** The planned item the API suggests for an unmapped row; null when it has none. */
  readonly suggestedPlannedItemId: string | null;
}

export interface DayGroup {
  readonly day: string;
  readonly rows: readonly TransactionListRow[];
}

/** What is left of the month's expense plan, for the rod above the list. */
export interface MonthSummary {
  /** Calendar day the period starts, 'YYYY-MM-DD' (names the month). */
  readonly periodStart: string;
  readonly left: MinorUnitAmount;
  readonly planned: MinorUnitAmount;
  /** Left over planned, 0..1. */
  readonly fraction: number;
  readonly state: RodState;
}

export const LIST_FILTERS: readonly ListFilter[] = ['all', 'toSort', 'sorted', 'transfers'];

const PERMILLE = 1000n;
const PERMILLE_NUMBER = 1000;

/**
 * Maps the API rows to list rows. Cancelled and expired rows count in no total, so they are not
 * listed. `categoryOfItem` names the suggested category of an unmapped row.
 */
export function toListRows(
  items: readonly TransactionListItemDto[],
  categoryOfItem: ReadonlyMap<string, string>,
): TransactionListRow[] {
  return items.filter(isCounted).map((item) => toListRow(item, categoryOfItem));
}

/** An accepted suggestion counts as sorted at once, before the list reloads. */
export function effectiveKind(row: TransactionListRow, applied: ReadonlySet<string>): RowKind {
  return row.kind === 'toSort' && applied.has(row.data.id) ? 'sorted' : row.kind;
}

export function filterCounts(
  rows: readonly TransactionListRow[],
  applied: ReadonlySet<string>,
): Record<ListFilter, number> {
  const kinds = rows.map((row) => effectiveKind(row, applied));

  return {
    all: rows.length,
    toSort: kinds.filter((kind) => kind === 'toSort').length,
    sorted: kinds.filter((kind) => kind === 'sorted').length,
    transfers: kinds.filter((kind) => kind === 'transfer').length,
  };
}

export function visibleRows(
  rows: readonly TransactionListRow[],
  filter: ListFilter,
  applied: ReadonlySet<string>,
): TransactionListRow[] {
  if (filter === 'all') {
    return [...rows];
  }
  const wanted: RowKind = filter === 'transfers' ? 'transfer' : filter;

  return rows.filter((row) => effectiveKind(row, applied) === wanted);
}

/** Groups rows by day, keeping the order of the rows (the API sends the newest first). */
export function groupByDay(rows: readonly TransactionListRow[]): DayGroup[] {
  const groups: { day: string; rows: TransactionListRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.day === row.day) {
      last.rows.push(row);
    } else {
      groups.push({ day: row.day, rows: [row] });
    }
  }

  return groups;
}

/** Spending still waiting to be sorted, in `currency`; undefined when nothing waits. */
export function waitingToSort(
  rows: readonly TransactionListRow[],
  applied: ReadonlySet<string>,
  currency: string,
): MinorUnitAmount | undefined {
  const waiting = rows
    .filter((row) => effectiveKind(row, applied) === 'toSort')
    .filter((row) => row.data.currency === currency && row.data.amountMinor < 0n)
    .reduce((sum, row) => sum - row.data.amountMinor, 0n);

  return waiting > 0n ? { amountMinor: waiting, currency } : undefined;
}

/** Planned expenses minus what was spent (mapped and unplanned), in the plan's base currency. */
export function monthSummaryOf(dashboard: PlanDashboardResponseDto): MonthSummary {
  const planned = parseMinorUnits(dashboard.totalPlannedExpenses.amountMinor);
  const spent =
    parseMinorUnits(dashboard.totalActualExpenses.amountMinor) +
    parseMinorUnits(dashboard.unplannedExpenses.amountMinor);
  const left = planned - spent;
  const currency = dashboard.baseCurrency;
  const fraction = fractionOf(left, planned);

  return {
    periodStart: dashboard.period.start,
    left: { amountMinor: left, currency },
    planned: { amountMinor: planned, currency },
    fraction,
    state: rodStateOf(left, fraction),
  };
}

function toListRow(
  item: TransactionListItemDto,
  categoryOfItem: ReadonlyMap<string, string>,
): TransactionListRow {
  const suggestedPlannedItemId = item.suggestedPlannedItemId;
  const kind = kindOf(item);
  const title = item.merchant ?? item.description;
  const categoryName = item.mapping?.categoryName ?? undefined;
  const suggestionLabel =
    kind === 'toSort' && suggestedPlannedItemId !== null
      ? categoryOfItem.get(suggestedPlannedItemId)
      : undefined;
  const data: TxRowData = {
    id: item.id,
    title,
    subtitle: categoryName ?? (item.merchant === null ? '' : item.description),
    amountMinor: parseMinorUnits(item.amount.amountMinor),
    currency: item.amount.currency,
    status: rowStatusOf(item, kind),
    ...(categoryName === undefined ? {} : { categoryLabel: categoryName }),
    ...(suggestionLabel === undefined ? {} : { suggestionLabel }),
  };
  const provenance = provenanceOf(item);

  return {
    data,
    day: item.occurredOn,
    kind,
    live: item.status === 'live',
    ...(provenance === undefined ? {} : { provenance }),
    suggestedPlannedItemId,
  };
}

function isCounted(item: TransactionListItemDto): boolean {
  return item.status !== 'cancelled' && item.status !== 'expired';
}

function kindOf(item: TransactionListItemDto): RowKind {
  if (item.transfer !== undefined && item.transfer !== null) {
    return 'transfer';
  }

  // An ignored transaction has nothing left to sort, mapped or not.
  const hasMapping = item.mapping !== undefined && item.mapping !== null;

  return hasMapping || item.ignored ? 'sorted' : 'toSort';
}

function rowStatusOf(item: TransactionListItemDto, kind: RowKind): TxRowData['status'] {
  if (kind === 'transfer') {
    return 'transfer';
  }
  if (kind === 'toSort') {
    return 'to-sort';
  }

  return item.status === 'pending' ? 'pending' : 'booked';
}

function provenanceOf(item: TransactionListItemDto): RowProvenance | undefined {
  if (item.mappingSource === 'manual') {
    return 'manual';
  }

  return item.mappingSource === 'rule' ? 'rule' : undefined;
}

function fractionOf(left: bigint, planned: bigint): number {
  if (left <= 0n || planned <= 0n) {
    return 0;
  }

  return Math.min(1, Number((left * PERMILLE) / planned) / PERMILLE_NUMBER);
}

function rodStateOf(left: bigint, fraction: number): RodState {
  if (left < 0n) {
    return 'over';
  }

  return fraction > 0 ? 'under' : 'empty';
}

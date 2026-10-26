import type { Transaction } from '../../domain/transactions/Transaction.js';
import type { MoneyAmount, PlanDashboard } from '../../domain/dashboard/PlanDashboard.js';
import { mappingViewOf } from './MappingView.js';

/** The transactions of one calendar day, newest day first (the API sends newest first). */
export interface DayGroup {
  /** Calendar date, 'YYYY-MM-DD'. */
  readonly day: string;
  readonly transactions: readonly Transaction[];
}

/** What is left of the month's expense plan, for the rod under the title. */
export interface MonthLeft {
  /** Calendar date of the period start, 'YYYY-MM-DD' (names the month). */
  readonly periodStart: string;
  readonly left: MoneyAmount;
  readonly planned: MoneyAmount;
  /** Left over planned, 0..1; 0 when nothing is left or nothing is planned. */
  readonly fraction: number;
}

/** Sorted vs to sort among the loaded rows. */
export interface SortingProgress {
  readonly sorted: number;
  readonly toSort: number;
}

/** Groups rows by `occurredOn`, keeping the order of the rows. */
export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const groups: { day: string; transactions: Transaction[] }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.day === tx.occurredOn) {
      last.transactions.push(tx);
    } else {
      groups.push({ day: tx.occurredOn, transactions: [tx] });
    }
  }

  return groups;
}

/** Planned expenses minus what was spent (mapped and unplanned), in the plan's base currency. */
export function monthLeft(dashboard: PlanDashboard): MonthLeft {
  const { plannedExpenses, actualExpenses, unplannedExpenses } = dashboard.totals;
  const planned = plannedExpenses.amountMinor;
  const spent = actualExpenses.amountMinor + unplannedExpenses.amountMinor;
  const left = planned - spent;
  const currency = dashboard.baseCurrency;

  return {
    periodStart: dashboard.periodStart,
    left: { amountMinor: left, currency },
    planned: { amountMinor: planned, currency },
    fraction: fractionOf(left, planned),
  };
}

/** A row is sorted once it is mapped, a transfer or ignored; the rest waits to be sorted. */
export function isToSort(tx: Transaction): boolean {
  return mappingViewOf(tx).kind === 'unmapped' && isCounted(tx);
}

export function sortingProgress(transactions: readonly Transaction[]): SortingProgress {
  let toSort = 0;
  let sorted = 0;
  for (const tx of transactions) {
    if (!isCounted(tx)) {
      continue;
    }
    if (isToSort(tx)) {
      toSort += 1;
    } else {
      sorted += 1;
    }
  }

  return { sorted, toSort };
}

/** Cancelled and expired rows count in no total, so they are neither sorted nor to sort. */
function isCounted(tx: Transaction): boolean {
  return tx.status !== 'cancelled' && tx.status !== 'expired';
}

function fractionOf(left: bigint, planned: bigint): number {
  if (left <= 0n || planned <= 0n) {
    return 0;
  }
  const permille = Number((left * 1000n) / planned);

  return Math.min(1, permille / 1000);
}

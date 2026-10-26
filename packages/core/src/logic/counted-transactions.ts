import type { Transaction, Transfer } from '../domain/transactions/entities.js';
import { isCountedTransactionStatus } from '../domain/transactions/entities.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import { IsoDate } from '../domain/shared/ids.js';
import type { PlanPeriod } from '../domain/plans/period.js';
import type { PlannedDirection } from '../domain/plans/enums.js';
import { DateRange } from '../domain/shared/date-range.js';
import { convertMoney } from './convert-money.js';

const ONE_DAY_MS = 86_400_000;

/** Inclusive calendar range of a plan period. */
export function planPeriodToDateRange(period: PlanPeriod): DateRange {
  if (period.kind === 'custom') {
    return period.range;
  }
  if (period.kind === 'monthly') {
    const mm = String(period.month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();

    return {
      start: IsoDate.of(`${period.year}-${mm}-01`),
      end: IsoDate.of(`${period.year}-${mm}-${String(lastDay).padStart(2, '0')}`),
    };
  }
  const startMs = Date.parse(`${period.startDate}T00:00:00Z`);
  const end = IsoDate.of(new Date(startMs + 6 * ONE_DAY_MS).toISOString().slice(0, 10));

  return { start: period.startDate, end };
}

/** Ids of both legs of every active transfer: money moved between own accounts. */
export function transferredTransactionIds(transfers: readonly Transfer[]): Set<TransactionId> {
  const ids = new Set<TransactionId>();
  for (const transfer of transfers) {
    if (transfer.status !== 'active') {
      continue;
    }
    ids.add(transfer.fromTransactionId);
    if (transfer.toTransactionId !== null) {
      ids.add(transfer.toTransactionId);
    }
  }

  return ids;
}

/**
 * The transactions that count towards actuals: booked inside the period, not
 * ignored, not cancelled or expired and not a leg of an active transfer.
 */
export function countedTransactions(
  transactions: readonly Transaction[],
  transfers: readonly Transfer[],
  period: DateRange,
): Transaction[] {
  const transferred = transferredTransactionIds(transfers);

  return transactions.filter(
    (tx) =>
      !tx.ignored &&
      isCountedTransactionStatus(tx.status) &&
      !transferred.has(tx.id) &&
      DateRange.contains(period, tx.bookedAt),
  );
}

/**
 * Signed sum in `base`, oriented by direction: for income, inflows count
 * positive; for expense, outflows count positive and a refund (an inflow)
 * reduces the spend. The result can be negative when refunds exceed spend.
 */
export function directedSumMinor(
  direction: PlannedDirection,
  transactions: readonly Transaction[],
  base: CurrencyCode,
  fxTable: FxRateTable,
): bigint {
  let signed = 0n;
  for (const tx of transactions) {
    signed += convertMoney(tx.amount, base, fxTable).amountMinor;
  }

  return direction === 'income' ? signed : -signed;
}

export function absMinor(value: bigint): bigint {
  return value < 0n ? -value : value;
}

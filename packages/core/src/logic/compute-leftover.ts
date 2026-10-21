import type { Plan, PlannedItem, LeftoverEntry } from '../domain/plans/entities.js';
import type { Transaction, Mapping, Transfer } from '../domain/transactions/entities.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { IsoDate } from '../domain/shared/ids.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { PlannedItemId } from '../domain/plans/ids.js';
import { LeftoverSnapshotId } from '../domain/plans/ids.js';
import { convertMoney } from './convert-money.js';
import {
  absMinor,
  countedTransactions,
  directedSumMinor,
  planPeriodToDateRange,
} from './counted-transactions.js';

export interface ComputeLeftoverParams {
  /** Only the id, period and base currency are read. */
  plan: Pick<Plan, 'id' | 'period' | 'baseCurrency'>;
  plannedItems: readonly PlannedItem[];
  transactions: readonly Transaction[];
  mappings: readonly Mapping[];
  transfers?: readonly Transfer[];
  fxTable: FxRateTable;
  clock: () => IsoDate;
}

function groupMappedByItem(
  transactions: readonly Transaction[],
  mappings: readonly Mapping[],
): Map<PlannedItemId, Transaction[]> {
  const txToItem = new Map<TransactionId, PlannedItemId>();
  for (const m of mappings) {
    txToItem.set(m.transactionId, m.plannedItemId);
  }
  const txsByItem = new Map<PlannedItemId, Transaction[]>();
  for (const tx of transactions) {
    const itemId = txToItem.get(tx.id);
    if (itemId === undefined) {
      continue;
    }
    const existing = txsByItem.get(itemId) ?? [];
    existing.push(tx);
    txsByItem.set(itemId, existing);
  }

  return txsByItem;
}

/**
 * Compute leftover per planned item.
 * Over-budget expense items contribute 0 leftover (not negative) per PRD §4.8.
 * Only transactions booked inside the plan period count; transfers and ignored
 * transactions are excluded. Sums are signed per direction, so a refund mapped
 * to an expense item reduces its spend.
 */
export function computeLeftover({
  plan,
  plannedItems,
  transactions,
  mappings,
  transfers = [],
  fxTable,
  clock,
}: ComputeLeftoverParams): LeftoverEntry[] {
  const base = plan.baseCurrency;
  const counted = countedTransactions(transactions, transfers, planPeriodToDateRange(plan.period));
  const txsByItem = groupMappedByItem(counted, mappings);
  const asOf = clock();

  return plannedItems.map((item, idx) => {
    const plannedAbs = absMinor(convertMoney(item.amount, base, fxTable).amountMinor);
    const actualMinor = directedSumMinor(
      item.direction,
      txsByItem.get(item.id) ?? [],
      base,
      fxTable,
    );

    // Over-budget → leftover is 0, never negative; refunds beyond the spend never add to it.
    const spentMinor = actualMinor > 0n ? actualMinor : 0n;
    const leftoverMinor = spentMinor >= plannedAbs ? 0n : plannedAbs - spentMinor;

    // Deterministic synthetic snapshot ID from index
    const snapshotId = LeftoverSnapshotId.of(
      `00000000-0000-7000-8000-${String(idx).padStart(12, '0')}`,
    );

    return {
      snapshotId,
      planId: plan.id,
      plannedItemId: item.id,
      categoryId: item.categoryId,
      plannedAmount: { amountMinor: plannedAbs, currency: base },
      actualAmount: { amountMinor: actualMinor, currency: base },
      leftover: { amountMinor: leftoverMinor, currency: base },
      asOf,
    } satisfies LeftoverEntry;
  });
}

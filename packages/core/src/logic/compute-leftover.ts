import type { Plan, PlannedItem, LeftoverEntry } from '../domain/plans/entities.js';
import type { Transaction, Mapping, Transfer } from '../domain/transactions/entities.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { IsoDate } from '../domain/shared/ids.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { PlannedItemId } from '../domain/plans/ids.js';
import { LeftoverSnapshotId } from '../domain/plans/ids.js';
import { convertMoney } from './convert-money.js';

export interface ComputeLeftoverParams {
  plan: Plan;
  plannedItems: readonly PlannedItem[];
  transactions: readonly Transaction[];
  mappings: readonly Mapping[];
  transfers?: readonly Transfer[];
  fxTable: FxRateTable;
  clock: () => IsoDate;
}

/**
 * Compute leftover per planned item.
 * Over-budget expense items contribute 0 leftover (not negative) per PRD §4.8.
 * Transfers and ignored transactions are excluded.
 * Only expense items generate meaningful leftover; income items included too.
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

  // Build transfer exclusion set
  const transferredTxIds = new Set<TransactionId>();
  for (const t of transfers) {
    if (t.status === 'active') {
      transferredTxIds.add(t.fromTransactionId);
      transferredTxIds.add(t.toTransactionId);
    }
  }

  // Filter active, non-ignored transactions
  const activeTxs = transactions.filter(
    (tx) => !(tx as unknown as Record<string, unknown>)['ignored'] && !transferredTxIds.has(tx.id),
  );

  // Build tx → item mapping
  const txToItem = new Map<TransactionId, PlannedItemId>();
  for (const m of mappings) txToItem.set(m.transactionId, m.plannedItemId);

  // Group transactions by planned item
  const txsByItem = new Map<PlannedItemId, Transaction[]>();
  for (const tx of activeTxs) {
    const itemId = txToItem.get(tx.id);
    if (!itemId) continue;
    const existing = txsByItem.get(itemId) ?? [];
    existing.push(tx);
    txsByItem.set(itemId, existing);
  }

  const asOf = clock();

  return plannedItems.map((item, idx) => {
    const plannedInBase = convertMoney(item.amount, base, fxTable);
    const plannedAbs =
      plannedInBase.amountMinor < 0n ? -plannedInBase.amountMinor : plannedInBase.amountMinor;

    const itemTxs = txsByItem.get(item.id) ?? [];
    let actualMinor = 0n;
    for (const tx of itemTxs) {
      const converted = convertMoney(tx.amount, base, fxTable);
      actualMinor += converted.amountMinor < 0n ? -converted.amountMinor : converted.amountMinor;
    }

    // Over-budget → leftover is 0, never negative
    const leftoverMinor = actualMinor >= plannedAbs ? 0n : plannedAbs - actualMinor;

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

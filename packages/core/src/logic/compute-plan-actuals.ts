import type { Plan, PlannedItem } from '../domain/plans/entities.js';
import type { Transaction, Mapping, Transfer } from '../domain/transactions/entities.js';
import type {
  PlanActualsView,
  PlannedItemActuals,
  ProgressBand,
} from '../domain/dashboard/entities.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { PlannedItemId } from '../domain/plans/ids.js';
import type { IsoDate } from '../domain/shared/ids.js';
import type { DateRange } from '../domain/shared/date-range.js';
import type { PlanPeriod } from '../domain/plans/period.js';
import { Money } from '../domain/shared/money.js';
import { convertMoney } from './convert-money.js';

export interface ComputePlanActualsParams {
  plan: Plan;
  plannedItems: readonly PlannedItem[];
  transactions: readonly Transaction[];
  mappings: readonly Mapping[];
  transfers: readonly Transfer[];
  fxTable: FxRateTable;
  clock: () => IsoDate;
}

function planPeriodToDateRange(period: PlanPeriod): DateRange {
  if (period.kind === 'custom') return period.range;
  if (period.kind === 'monthly') {
    const mm = String(period.month).padStart(2, '0');
    const start = `${period.year}-${mm}-01` as IsoDate;
    const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
    const end = `${period.year}-${mm}-${String(lastDay).padStart(2, '0')}` as IsoDate;
    return { start, end };
  }
  // weekly: startDate through startDate + 6 days
  const startMs = Date.parse(`${period.startDate}T00:00:00Z`);
  const end = new Date(startMs + 6 * 86_400_000).toISOString().slice(0, 10) as IsoDate;
  return { start: period.startDate, end };
}

function progressBand(plannedMinor: bigint, actualMinor: bigint): ProgressBand {
  if (plannedMinor === 0n) return actualMinor > 0n ? 'over' : 'ok';
  if (actualMinor >= plannedMinor) return 'over';
  if (actualMinor * 100n >= plannedMinor * 80n) return 'warning';
  return 'ok';
}

export function computePlanActuals({
  plan,
  plannedItems,
  transactions,
  mappings,
  transfers,
  fxTable,
  clock,
}: ComputePlanActualsParams): PlanActualsView {
  const base = plan.baseCurrency;

  // Build set of transaction IDs involved in active transfers
  const transferredTxIds = new Set<TransactionId>();
  for (const t of transfers) {
    if (t.status === 'active') {
      transferredTxIds.add(t.fromTransactionId);
      transferredTxIds.add(t.toTransactionId);
    }
  }

  // Exclude ignored and transferred transactions
  const activeTxs = transactions.filter((tx) => !tx.ignored && !transferredTxIds.has(tx.id));

  // Build mapping index: transactionId → plannedItemId
  const txToItem = new Map<TransactionId, PlannedItemId>();
  for (const m of mappings) {
    txToItem.set(m.transactionId, m.plannedItemId);
  }

  // Group active transactions by plannedItemId; collect unmapped ones
  const txsByItem = new Map<PlannedItemId, Transaction[]>();
  const unmappedTxs: Transaction[] = [];

  for (const tx of activeTxs) {
    const itemId = txToItem.get(tx.id);
    if (itemId !== undefined) {
      let group = txsByItem.get(itemId);
      if (group === undefined) {
        group = [];
        txsByItem.set(itemId, group);
      }
      group.push(tx);
    } else {
      unmappedTxs.push(tx);
    }
  }

  // Build per-item actuals lines
  const incomeLines: PlannedItemActuals[] = [];
  const expenseLines: PlannedItemActuals[] = [];

  for (const item of plannedItems) {
    const plannedInBase = convertMoney(item.amount, base, fxTable);
    const plannedMinor =
      plannedInBase.amountMinor < 0n ? -plannedInBase.amountMinor : plannedInBase.amountMinor;

    let actualMinor = 0n;
    for (const tx of txsByItem.get(item.id) ?? []) {
      const converted = convertMoney(tx.amount, base, fxTable);
      actualMinor += converted.amountMinor < 0n ? -converted.amountMinor : converted.amountMinor;
    }

    const planned = Money.of(plannedMinor, base);
    const actual = Money.of(actualMinor, base);
    const remaining = Money.of(plannedMinor - actualMinor, base);
    const band = progressBand(plannedMinor, actualMinor);

    const line: PlannedItemActuals = {
      plannedItemId: item.id,
      categoryId: item.categoryId,
      direction: item.direction,
      planned,
      actual,
      remaining,
      progressBand: band,
    };

    if (item.direction === 'income') {
      incomeLines.push(line);
    } else {
      expenseLines.push(line);
    }
  }

  // Unplanned totals — split by sign
  let unplannedIncomeMinor = 0n;
  let unplannedExpenseMinor = 0n;
  for (const tx of unmappedTxs) {
    const converted = convertMoney(tx.amount, base, fxTable);
    if (converted.amountMinor > 0n) {
      unplannedIncomeMinor += converted.amountMinor;
    } else {
      unplannedExpenseMinor += -converted.amountMinor;
    }
  }

  const totalPlannedIncome = Money.of(
    incomeLines.reduce((s, l) => s + l.planned.amountMinor, 0n),
    base,
  );
  const totalActualIncome = Money.of(
    incomeLines.reduce((s, l) => s + l.actual.amountMinor, 0n),
    base,
  );
  const totalPlannedExpenses = Money.of(
    expenseLines.reduce((s, l) => s + l.planned.amountMinor, 0n),
    base,
  );
  const totalActualExpenses = Money.of(
    expenseLines.reduce((s, l) => s + l.actual.amountMinor, 0n),
    base,
  );

  const net = Money.of(totalActualIncome.amountMinor - totalActualExpenses.amountMinor, base);

  return {
    planId: plan.id,
    period: planPeriodToDateRange(plan.period),
    baseCurrency: base,
    incomeLines,
    expenseLines,
    totalPlannedIncome,
    totalActualIncome,
    totalPlannedExpenses,
    totalActualExpenses,
    unplannedExpenses: Money.of(unplannedExpenseMinor, base),
    unplannedIncome: Money.of(unplannedIncomeMinor, base),
    net,
    asOf: clock(),
  };
}

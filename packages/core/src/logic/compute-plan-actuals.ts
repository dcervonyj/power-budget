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
import type { CurrencyCode } from '../domain/shared/currency.js';
import { Money } from '../domain/shared/money.js';
import { convertMoney } from './convert-money.js';
import {
  absMinor,
  countedTransactions,
  directedSumMinor,
  planPeriodToDateRange,
} from './counted-transactions.js';

export interface ComputePlanActualsParams {
  /** Only the id, period and base currency are read. */
  plan: Pick<Plan, 'id' | 'period' | 'baseCurrency'>;
  plannedItems: readonly PlannedItem[];
  /**
   * Candidate transactions; only the ones booked inside the plan period, not
   * ignored, not cancelled and not part of an active transfer are counted.
   */
  transactions: readonly Transaction[];
  mappings: readonly Mapping[];
  transfers: readonly Transfer[];
  /** Rates used to convert every amount into the plan's base currency. */
  fxTable: FxRateTable;
  clock: () => IsoDate;
}

interface TransactionsByItem {
  readonly mapped: ReadonlyMap<PlannedItemId, readonly Transaction[]>;
  readonly unmapped: readonly Transaction[];
}

function progressBand(plannedMinor: bigint, actualMinor: bigint): ProgressBand {
  if (plannedMinor === 0n) {
    return actualMinor > 0n ? 'over' : 'ok';
  }
  if (actualMinor >= plannedMinor) {
    return 'over';
  }
  if (actualMinor * 100n >= plannedMinor * 80n) {
    return 'warning';
  }

  return 'ok';
}

/**
 * Groups transactions by the planned item of this plan they are mapped to.
 * A transaction mapped to an item of another plan belongs to that plan and is
 * left out here; only transactions with no mapping at all are unplanned.
 */
function groupByItem(
  transactions: readonly Transaction[],
  mappings: readonly Mapping[],
  plannedItems: readonly PlannedItem[],
): TransactionsByItem {
  const txToItem = new Map<TransactionId, PlannedItemId>();
  for (const m of mappings) {
    txToItem.set(m.transactionId, m.plannedItemId);
  }
  const mapped = new Map<PlannedItemId, Transaction[]>(plannedItems.map((item) => [item.id, []]));
  const unmapped: Transaction[] = [];
  for (const tx of transactions) {
    const itemId = txToItem.get(tx.id);
    if (itemId === undefined) {
      unmapped.push(tx);
      continue;
    }
    mapped.get(itemId)?.push(tx);
  }

  return { mapped, unmapped };
}

function itemLine(
  item: PlannedItem,
  transactions: readonly Transaction[],
  base: CurrencyCode,
  fxTable: FxRateTable,
): PlannedItemActuals {
  const plannedMinor = absMinor(convertMoney(item.amount, base, fxTable).amountMinor);
  const actualMinor = directedSumMinor(item.direction, transactions, base, fxTable);

  return {
    plannedItemId: item.id,
    categoryId: item.categoryId,
    direction: item.direction,
    planned: Money.of(plannedMinor, base),
    actual: Money.of(actualMinor, base),
    remaining: Money.of(plannedMinor - actualMinor, base),
    progressBand: progressBand(plannedMinor, actualMinor),
  };
}

function sumMinor(lines: readonly PlannedItemActuals[], pick: 'planned' | 'actual'): bigint {
  return lines.reduce((sum, line) => sum + line[pick].amountMinor, 0n);
}

/**
 * The plan dashboard: planned vs actual per item, unplanned totals and the net,
 * all in the plan's base currency. Sums are signed per direction, so a refund
 * mapped to an expense item reduces its spend.
 */
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
  const period = planPeriodToDateRange(plan.period);
  const counted = countedTransactions(transactions, transfers, period);
  const { mapped, unmapped } = groupByItem(counted, mappings, plannedItems);

  const incomeLines: PlannedItemActuals[] = [];
  const expenseLines: PlannedItemActuals[] = [];
  for (const item of plannedItems) {
    const line = itemLine(item, mapped.get(item.id) ?? [], base, fxTable);
    if (item.direction === 'income') {
      incomeLines.push(line);
    } else {
      expenseLines.push(line);
    }
  }

  // Unplanned money has no direction of its own: inflows are income, outflows expense.
  let unplannedIncomeMinor = 0n;
  let unplannedExpenseMinor = 0n;
  for (const tx of unmapped) {
    const converted = convertMoney(tx.amount, base, fxTable).amountMinor;
    if (converted > 0n) {
      unplannedIncomeMinor += converted;
    } else {
      unplannedExpenseMinor -= converted;
    }
  }

  const totalActualIncomeMinor = sumMinor(incomeLines, 'actual');
  const totalActualExpensesMinor = sumMinor(expenseLines, 'actual');

  return {
    planId: plan.id,
    period,
    baseCurrency: base,
    incomeLines,
    expenseLines,
    totalPlannedIncome: Money.of(sumMinor(incomeLines, 'planned'), base),
    totalActualIncome: Money.of(totalActualIncomeMinor, base),
    totalPlannedExpenses: Money.of(sumMinor(expenseLines, 'planned'), base),
    totalActualExpenses: Money.of(totalActualExpensesMinor, base),
    unplannedExpenses: Money.of(unplannedExpenseMinor, base),
    unplannedIncome: Money.of(unplannedIncomeMinor, base),
    // PRODUCT §4.11: (planned + unplanned income) - (planned + unplanned expense).
    net: Money.of(
      totalActualIncomeMinor +
        unplannedIncomeMinor -
        (totalActualExpensesMinor + unplannedExpenseMinor),
      base,
    ),
    asOf: clock(),
  };
}

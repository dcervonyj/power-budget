import { describe, it, expect } from 'vitest';
import { computePlanActuals } from '@power-budget/core';
import type { Plan, PlannedItem, Transaction, Mapping } from '@power-budget/core';
import type { FxRateTable } from '@power-budget/core';
import type {
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  HouseholdId,
  UserId,
  CategoryId,
  TransactionId,
  TransactionMappingId,
  BankAccountId,
} from '@power-budget/core';

// Cast helper for tests
const id = <T>(s: string): T => s as unknown as T;

const CLOCK = (): IsoDate => id('2024-01-31');
const FX_TABLE: FxRateTable = new Map();

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: id('plan-1'),
    householdId: id('hh-1'),
    name: 'Jan Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { kind: 'custom', range: { start: id('2024-01-01'), end: id('2024-01-31') } },
    baseCurrency: 'PLN',
    createdByUserId: id('user-1'),
    createdAt: id('2024-01-01T00:00:00Z'),
    updatedAt: id('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makePlannedItem(overrides: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id: id('item-1'),
    planId: id<PlanId>('plan-1'),
    householdId: id<HouseholdId>('hh-1'),
    categoryId: id<CategoryId>('cat-1'),
    direction: 'expense',
    amount: { amountMinor: 10000n, currency: 'PLN' },
    note: null,
    createdAt: id('2024-01-01T00:00:00Z'),
    updatedAt: id('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * These tests document the expected shape of PlanActualsView, which
 * DrizzlePlanActualsReader must produce from the v_plan_actuals materialized view.
 */
describe('PlanActualsView shape (via computePlanActuals)', () => {
  it('returns the correct structure for an empty plan', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: FX_TABLE,
      clock: CLOCK,
    });

    // Top-level shape
    expect(result).toHaveProperty('planId');
    expect(result).toHaveProperty('period');
    expect(result.period).toHaveProperty('start');
    expect(result.period).toHaveProperty('end');
    expect(result).toHaveProperty('baseCurrency', 'PLN');
    expect(result).toHaveProperty('incomeLines');
    expect(result).toHaveProperty('expenseLines');
    expect(result).toHaveProperty('totalPlannedIncome');
    expect(result).toHaveProperty('totalActualIncome');
    expect(result).toHaveProperty('totalPlannedExpenses');
    expect(result).toHaveProperty('totalActualExpenses');
    expect(result).toHaveProperty('unplannedExpenses');
    expect(result).toHaveProperty('unplannedIncome');
    expect(result).toHaveProperty('net');
    expect(result).toHaveProperty('asOf', '2024-01-31');

    // Money shape
    expect(result.totalPlannedIncome).toEqual({ amountMinor: 0n, currency: 'PLN' });
    expect(result.net).toEqual({ amountMinor: 0n, currency: 'PLN' });
  });

  it('correctly computes per-item actuals shape', () => {
    const item = makePlannedItem({
      direction: 'expense',
      amount: { amountMinor: 5000n, currency: 'PLN' },
    });
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [item],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: FX_TABLE,
      clock: CLOCK,
    });

    expect(result.expenseLines).toHaveLength(1);
    const line = result.expenseLines[0]!;

    // PlannedItemActuals shape
    expect(line).toHaveProperty('plannedItemId', 'item-1');
    expect(line).toHaveProperty('categoryId', 'cat-1');
    expect(line).toHaveProperty('direction', 'expense');
    expect(line.planned).toEqual({ amountMinor: 5000n, currency: 'PLN' });
    expect(line.actual).toEqual({ amountMinor: 0n, currency: 'PLN' });
    expect(line.remaining).toEqual({ amountMinor: 5000n, currency: 'PLN' });
    expect(line.progressBand).toBe('ok');
  });

  it('computes progressBand correctly at 80% threshold', () => {
    const item = makePlannedItem({
      id: id<PlannedItemId>('item-1'),
      direction: 'expense',
      amount: { amountMinor: 10000n, currency: 'PLN' },
    });
    const tx: Transaction = {
      id: id<TransactionId>('tx-1'),
      householdId: id<HouseholdId>('hh-1'),
      accountId: id<BankAccountId>('acc-1'),
      externalId: null,
      source: 'bank',
      status: 'posted',
      amount: { amountMinor: -8000n, currency: 'PLN' },
      description: 'Test',
      merchantName: null,
      bookedAt: id<IsoDate>('2024-01-10'),
      createdAt: id<IsoDateTime>('2024-01-10T00:00:00Z'),
      ignored: false,
    };
    const mapping: Mapping = {
      id: id<TransactionMappingId>('map-1'),
      householdId: id<HouseholdId>('hh-1'),
      transactionId: id<TransactionId>('tx-1'),
      plannedItemId: id<PlannedItemId>('item-1'),
      createdByUserId: id<UserId>('user-1'),
      createdAt: id<IsoDateTime>('2024-01-10T00:00:00Z'),
    };

    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [item],
      transactions: [tx],
      mappings: [mapping],
      transfers: [],
      fxTable: FX_TABLE,
      clock: CLOCK,
    });

    expect(result.expenseLines[0]!.progressBand).toBe('warning');
    expect(result.totalActualExpenses).toEqual({ amountMinor: 8000n, currency: 'PLN' });
  });

  it('separates income and expense lines', () => {
    const incomeItem = makePlannedItem({
      id: id<PlannedItemId>('item-income'),
      direction: 'income',
      amount: { amountMinor: 20000n, currency: 'PLN' },
    });
    const expenseItem = makePlannedItem({
      id: id<PlannedItemId>('item-expense'),
      direction: 'expense',
      amount: { amountMinor: 10000n, currency: 'PLN' },
    });

    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [incomeItem, expenseItem],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: FX_TABLE,
      clock: CLOCK,
    });

    expect(result.incomeLines).toHaveLength(1);
    expect(result.expenseLines).toHaveLength(1);
    expect(result.totalPlannedIncome).toEqual({ amountMinor: 20000n, currency: 'PLN' });
    expect(result.totalPlannedExpenses).toEqual({ amountMinor: 10000n, currency: 'PLN' });
  });
});

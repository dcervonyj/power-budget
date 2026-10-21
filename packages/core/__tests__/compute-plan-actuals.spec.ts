import { describe, it, expect } from 'vitest';
import { computePlanActuals } from '../src/logic/compute-plan-actuals.js';
import { UnknownCurrencyPairError } from '../src/logic/convert-money.js';
import type { Plan, PlannedItem } from '../src/domain/plans/entities.js';
import type { Transaction, Mapping, Transfer } from '../src/domain/transactions/entities.js';
import type { FxRateTable, FxRate } from '../src/domain/currency/entities.js';

// Cast helper — avoids UUIDv7 validation in tests
const id = <T>(s: string): T => s as unknown as T;

const CLOCK = (): import('../src/domain/shared/ids.js').IsoDate => id('2024-01-31');

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
    planId: id('plan-1'),
    householdId: id('hh-1'),
    categoryId: id('cat-1'),
    direction: 'expense',
    amount: { amountMinor: 10000n, currency: 'PLN' },
    note: null,
    createdAt: id('2024-01-01T00:00:00Z'),
    updatedAt: id('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeTx(
  id_str: string,
  amountMinor: bigint,
  currency = 'PLN',
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: id(id_str),
    householdId: id('hh-1'),
    accountId: id('acc-1'),
    externalId: null,
    source: 'bank',
    status: 'posted',
    amount: { amountMinor, currency: currency as 'PLN' },
    description: 'Test',
    merchantName: null,
    bookedAt: id('2024-01-15'),
    createdAt: id('2024-01-15T00:00:00Z'),
    ignored: false,
    ...overrides,
  };
}

function makeMapping(txId: string, itemId: string, mapId = 'map-1'): Mapping {
  return {
    id: id(mapId),
    householdId: id('hh-1'),
    transactionId: id(txId),
    plannedItemId: id(itemId),
    createdByUserId: id('user-1'),
    createdAt: id('2024-01-15T00:00:00Z'),
  };
}

const emptyFxTable: FxRateTable = new Map();

function makeEurPlnTable(): FxRateTable {
  const m = new Map<string, FxRate>();
  m.set('EUR/PLN', {
    id: id('fx-1'),
    baseCurrency: 'EUR',
    quoteCurrency: 'PLN',
    rate: '4.25',
    rateDate: id('2024-01-31'),
    source: 'ecb',
    fetchedAt: id('2024-01-31T16:30:00Z'),
  });
  return m;
}

describe('computePlanActuals', () => {
  it('returns empty view for plan with no items or transactions', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.planId).toBe('plan-1');
    expect(result.incomeLines).toHaveLength(0);
    expect(result.expenseLines).toHaveLength(0);
    expect(result.totalPlannedIncome.amountMinor).toBe(0n);
    expect(result.totalActualIncome.amountMinor).toBe(0n);
    expect(result.totalPlannedExpenses.amountMinor).toBe(0n);
    expect(result.totalActualExpenses.amountMinor).toBe(0n);
    expect(result.unplannedIncome.amountMinor).toBe(0n);
    expect(result.unplannedExpenses.amountMinor).toBe(0n);
    expect(result.net.amountMinor).toBe(0n);
    expect(result.asOf).toBe('2024-01-31');
  });

  it('computes fully-mapped expense line with warning band at 80%', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()], // 100.00 PLN planned
      transactions: [makeTx('tx-1', -8000n)], // 80.00 PLN spent
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines).toHaveLength(1);
    const line = result.expenseLines[0]!;
    expect(line.planned.amountMinor).toBe(10000n);
    expect(line.actual.amountMinor).toBe(8000n);
    expect(line.remaining.amountMinor).toBe(2000n);
    expect(line.progressBand).toBe('warning');
    expect(result.totalPlannedExpenses.amountMinor).toBe(10000n);
    expect(result.totalActualExpenses.amountMinor).toBe(8000n);
  });

  it('marks expense as over-budget and has negative remaining when actual >= planned', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()], // 100.00 PLN
      transactions: [makeTx('tx-1', -12000n)], // 120.00 PLN — over budget
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    const line = result.expenseLines[0]!;
    expect(line.progressBand).toBe('over');
    expect(line.remaining.amountMinor).toBeLessThan(0n); // -2000n
    expect(line.remaining.amountMinor).toBe(-2000n);
  });

  it('marks expense as ok when actual is below 80% of planned', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()], // 100.00 PLN
      transactions: [makeTx('tx-1', -5000n)], // 50.00 PLN — under 80%
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.progressBand).toBe('ok');
  });

  it('excludes ignored transactions from actuals', () => {
    const tx = makeTx('tx-1', -8000n, 'PLN', { ignored: true });
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()],
      transactions: [tx],
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.actual.amountMinor).toBe(0n);
  });

  it('excludes transactions in active transfers from actuals', () => {
    const tx = makeTx('tx-1', -8000n);
    const transfer: Transfer = {
      id: id('tr-1'),
      householdId: id('hh-1'),
      fromTransactionId: id('tx-1'),
      toTransactionId: id('tx-2'),
      status: 'active',
      createdAt: id('2024-01-15T00:00:00Z'),
    };
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()],
      transactions: [tx],
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [transfer],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.actual.amountMinor).toBe(0n);
  });

  it('does NOT exclude transactions in reversed (non-active) transfers', () => {
    const tx = makeTx('tx-1', -8000n);
    const transfer: Transfer = {
      id: id('tr-1'),
      householdId: id('hh-1'),
      fromTransactionId: id('tx-1'),
      toTransactionId: id('tx-2'),
      status: 'reversed',
      createdAt: id('2024-01-15T00:00:00Z'),
    };
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem()],
      transactions: [tx],
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [transfer],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.actual.amountMinor).toBe(8000n);
  });

  it('accumulates unplanned transactions in separate income/expense buckets', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [],
      transactions: [
        makeTx('tx-1', 5000n), // positive → unplanned income
        makeTx('tx-2', -3000n), // negative → unplanned expense
      ],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.unplannedIncome.amountMinor).toBe(5000n);
    expect(result.unplannedExpenses.amountMinor).toBe(3000n);
  });

  it('converts cross-currency transaction amounts via FX table', () => {
    const fxTable = makeEurPlnTable(); // EUR/PLN = 4.25
    const result = computePlanActuals({
      plan: makePlan(), // baseCurrency PLN
      plannedItems: [makePlannedItem({ amount: { amountMinor: 10000n, currency: 'PLN' } })],
      transactions: [makeTx('tx-1', -1000n, 'EUR')], // 10.00 EUR → 42.50 PLN (4250 minor)
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.actual.amountMinor).toBe(4250n);
    expect(result.expenseLines[0]!.actual.currency).toBe('PLN');
  });

  it('uses the clock parameter for asOf — no Date.now() inside', () => {
    const customClock = (): import('../src/domain/shared/ids.js').IsoDate => id('2024-06-15');
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: customClock,
    });
    expect(result.asOf).toBe('2024-06-15');
  });

  it('computes net as totalActualIncome minus totalActualExpenses', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [
        makePlannedItem({
          id: id('item-income'),
          direction: 'income',
          amount: { amountMinor: 25000n, currency: 'PLN' },
        }),
        makePlannedItem({
          id: id('item-expense'),
          direction: 'expense',
          amount: { amountMinor: 10000n, currency: 'PLN' },
        }),
      ],
      transactions: [makeTx('tx-income', 20000n), makeTx('tx-expense', -8000n)],
      mappings: [
        makeMapping('tx-income', 'item-income', 'map-1'),
        makeMapping('tx-expense', 'item-expense', 'map-2'),
      ],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.totalActualIncome.amountMinor).toBe(20000n);
    expect(result.totalActualExpenses.amountMinor).toBe(8000n);
    expect(result.net.amountMinor).toBe(12000n); // 20000 - 8000
    expect(result.incomeLines).toHaveLength(1);
    expect(result.expenseLines).toHaveLength(1);
  });

  it('handles monthly period — converts to DateRange with correct last day', () => {
    const result = computePlanActuals({
      plan: makePlan({ period: { kind: 'monthly', year: 2024, month: 2 } }), // Feb 2024 (leap year)
      plannedItems: [],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.period.start).toBe('2024-02-01');
    expect(result.period.end).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('handles weekly period — sets end to startDate + 6 days', () => {
    const result = computePlanActuals({
      plan: makePlan({ period: { kind: 'weekly', startDate: id('2024-01-01') } }),
      plannedItems: [],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.period.start).toBe('2024-01-01');
    expect(result.period.end).toBe('2024-01-07');
  });

  it('progressBand is over when planned is 0n but actual is positive', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem({ amount: { amountMinor: 0n, currency: 'PLN' } })],
      transactions: [makeTx('tx-1', -1000n)],
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.progressBand).toBe('over');
  });

  it('progressBand is ok when both planned and actual are 0n', () => {
    const result = computePlanActuals({
      plan: makePlan(),
      plannedItems: [makePlannedItem({ amount: { amountMinor: 0n, currency: 'PLN' } })],
      transactions: [],
      mappings: [],
      transfers: [],
      fxTable: emptyFxTable,
      clock: CLOCK,
    });
    expect(result.expenseLines[0]!.progressBand).toBe('ok');
  });

  describe('CLN-012 correctness', () => {
    function actuals(
      overrides: Partial<Parameters<typeof computePlanActuals>[0]>,
    ): ReturnType<typeof computePlanActuals> {
      return computePlanActuals({
        plan: makePlan(),
        plannedItems: [makePlannedItem()],
        transactions: [],
        mappings: [],
        transfers: [],
        fxTable: emptyFxTable,
        clock: CLOCK,
        ...overrides,
      });
    }

    it('reduces expense spend by a refund mapped to the same item', () => {
      const result = actuals({
        transactions: [makeTx('tx-buy', -9000n), makeTx('tx-refund', 4000n)],
        mappings: [
          makeMapping('tx-buy', 'item-1', 'm-1'),
          makeMapping('tx-refund', 'item-1', 'm-2'),
        ],
      });
      const line = result.expenseLines[0]!;
      expect(line.actual).toEqual({ amountMinor: 5000n, currency: 'PLN' });
      expect(line.remaining.amountMinor).toBe(5000n);
      expect(line.progressBand).toBe('ok');
      expect(result.totalActualExpenses.amountMinor).toBe(5000n);
    });

    it('reduces received income by a reversal mapped to the income item', () => {
      const result = actuals({
        plannedItems: [makePlannedItem({ direction: 'income' })],
        transactions: [makeTx('tx-pay', 10000n), makeTx('tx-chargeback', -2500n)],
        mappings: [
          makeMapping('tx-pay', 'item-1', 'm-1'),
          makeMapping('tx-chargeback', 'item-1', 'm-2'),
        ],
      });
      expect(result.incomeLines[0]!.actual.amountMinor).toBe(7500n);
    });

    it('excludes both legs of a transfer, and a one-sided transfer leg', () => {
      const transfers: Transfer[] = [
        {
          id: id('tr-1'),
          householdId: id('hh-1'),
          fromTransactionId: id('tx-out'),
          toTransactionId: id('tx-in'),
          status: 'active',
          createdAt: id('2024-01-15T00:00:00Z'),
        },
        {
          id: id('tr-2'),
          householdId: id('hh-1'),
          fromTransactionId: id('tx-savings'),
          toTransactionId: null,
          status: 'active',
          createdAt: id('2024-01-15T00:00:00Z'),
        },
      ];
      const result = actuals({
        transactions: [
          makeTx('tx-out', -5000n),
          makeTx('tx-in', 5000n),
          makeTx('tx-savings', -7000n),
        ],
        transfers,
      });
      expect(result.unplannedIncome.amountMinor).toBe(0n);
      expect(result.unplannedExpenses.amountMinor).toBe(0n);
    });

    it('excludes ignored and cancelled transactions from the unplanned totals', () => {
      const result = actuals({
        transactions: [
          makeTx('tx-ignored', -5000n, 'PLN', { ignored: true }),
          makeTx('tx-cancelled', -6000n, 'PLN', { status: 'cancelled' }),
          makeTx('tx-real', -700n),
        ],
      });
      expect(result.unplannedExpenses.amountMinor).toBe(700n);
    });

    it('counts only transactions booked inside the period, bounds inclusive', () => {
      const result = actuals({
        transactions: [
          makeTx('tx-before', -1n, 'PLN', { bookedAt: id('2023-12-31') }),
          makeTx('tx-first', -10n, 'PLN', { bookedAt: id('2024-01-01') }),
          makeTx('tx-last', -100n, 'PLN', { bookedAt: id('2024-01-31') }),
          makeTx('tx-after', -1000n, 'PLN', { bookedAt: id('2024-02-01') }),
          makeTx('tx-unplanned-after', -5000n, 'PLN', { bookedAt: id('2024-02-01') }),
        ],
        mappings: ['tx-before', 'tx-first', 'tx-last', 'tx-after'].map((tx, i) =>
          makeMapping(tx, 'item-1', `m-${i}`),
        ),
      });
      expect(result.expenseLines[0]!.actual.amountMinor).toBe(110n);
      expect(result.unplannedExpenses.amountMinor).toBe(0n);
    });

    it('leaves out a transaction mapped to another plan instead of calling it unplanned', () => {
      const result = actuals({
        transactions: [makeTx('tx-other-plan', -4000n)],
        mappings: [makeMapping('tx-other-plan', 'item-of-another-plan')],
      });
      expect(result.expenseLines[0]!.actual.amountMinor).toBe(0n);
      expect(result.unplannedExpenses.amountMinor).toBe(0n);
    });

    it('converts PLN and EUR planned items and transactions into the base currency', () => {
      const result = actuals({
        plannedItems: [
          makePlannedItem({ id: id('item-pln') }),
          makePlannedItem({ id: id('item-eur'), amount: { amountMinor: 5000n, currency: 'EUR' } }),
        ],
        transactions: [
          makeTx('tx-pln', -3000n),
          makeTx('tx-eur', -2000n, 'EUR'),
          makeTx('tx-eur-unplanned', -100n, 'EUR'),
        ],
        mappings: [
          makeMapping('tx-pln', 'item-pln', 'm-1'),
          makeMapping('tx-eur', 'item-eur', 'm-2'),
        ],
        fxTable: makeEurPlnTable(), // 1 EUR = 4.25 PLN
      });
      expect(result.expenseLines.map((l) => [l.planned.amountMinor, l.actual.amountMinor])).toEqual(
        [
          [10000n, 3000n],
          [21250n, 8500n],
        ],
      );
      expect(result.totalPlannedExpenses).toEqual({ amountMinor: 31250n, currency: 'PLN' });
      expect(result.totalActualExpenses).toEqual({ amountMinor: 11500n, currency: 'PLN' });
      expect(result.unplannedExpenses).toEqual({ amountMinor: 425n, currency: 'PLN' });
    });

    it('converts into a EUR base currency through the inverse rate', () => {
      const result = actuals({
        plan: makePlan({ baseCurrency: 'EUR' }),
        plannedItems: [makePlannedItem({ amount: { amountMinor: 4250n, currency: 'PLN' } })],
        transactions: [makeTx('tx-pln', -850n)],
        mappings: [makeMapping('tx-pln', 'item-1')],
        fxTable: makeEurPlnTable(),
      });
      expect(result.expenseLines[0]!.planned).toEqual({ amountMinor: 1000n, currency: 'EUR' });
      expect(result.expenseLines[0]!.actual).toEqual({ amountMinor: 200n, currency: 'EUR' });
    });

    it('throws UnknownCurrencyPairError when a needed rate is missing', () => {
      expect(() =>
        actuals({ transactions: [makeTx('tx-usd', -100n, 'USD')], fxTable: makeEurPlnTable() }),
      ).toThrow(UnknownCurrencyPairError);
    });

    it('includes unplanned money in the net (PRODUCT §4.11)', () => {
      const result = actuals({
        plannedItems: [
          makePlannedItem({ id: id('item-income'), direction: 'income' }),
          makePlannedItem({ id: id('item-expense') }),
        ],
        transactions: [
          makeTx('tx-salary', 20000n),
          makeTx('tx-rent', -8000n),
          makeTx('tx-gift', 1000n),
          makeTx('tx-taxi', -300n),
        ],
        mappings: [
          makeMapping('tx-salary', 'item-income', 'm-1'),
          makeMapping('tx-rent', 'item-expense', 'm-2'),
        ],
      });
      expect(result.net.amountMinor).toBe(20000n + 1000n - 8000n - 300n);
    });
  });
});

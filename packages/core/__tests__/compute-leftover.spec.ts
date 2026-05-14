import { describe, it, expect } from 'vitest';
import { computeLeftover } from '../src/logic/compute-leftover.js';
import { convertMoney, UnknownCurrencyPairError } from '../src/logic/convert-money.js';
import type { Plan, PlannedItem } from '../src/domain/plans/entities.js';
import type { Transaction, Mapping, Transfer } from '../src/domain/transactions/entities.js';
import type { FxRate, FxRateTable } from '../src/domain/currency/entities.js';
import type { CurrencyCode } from '../src/domain/shared/currency.js';
import type { IsoDate, IsoDateTime } from '../src/domain/shared/ids.js';

const id = <T>(s: string): T => s as unknown as T;
const DT = (s: string): IsoDateTime => s as unknown as IsoDateTime;
const D = (s: string): IsoDate => s as unknown as IsoDate;
const CLOCK = (): IsoDate => D('2024-01-31');

function makePlan(overrides?: Partial<Plan>): Plan {
  return {
    id: id('plan-1'),
    householdId: id('hh-1'),
    name: 'Test',
    type: 'personal',
    periodKind: 'monthly',
    period: { kind: 'monthly', year: 2024, month: 1 },
    baseCurrency: 'PLN',
    createdByUserId: id('u-1'),
    createdAt: DT('2024-01-01T00:00:00Z'),
    updatedAt: DT('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeItem(
  id_str: string,
  amountMinor: bigint,
  direction: 'income' | 'expense' = 'expense',
): PlannedItem {
  return {
    id: id(id_str),
    planId: id('plan-1'),
    householdId: id('hh-1'),
    categoryId: id('cat-1'),
    direction,
    amount: { amountMinor, currency: 'PLN' },
    note: null,
    createdAt: DT('2024-01-01T00:00:00Z'),
    updatedAt: DT('2024-01-01T00:00:00Z'),
  };
}

function makeTx(
  id_str: string,
  amountMinor: bigint,
  currency: CurrencyCode = 'PLN',
  extra: Record<string, unknown> = {},
): Transaction {
  return {
    id: id(id_str),
    householdId: id('hh-1'),
    accountId: id('acc-1'),
    externalId: null,
    source: 'bank',
    status: 'posted',
    amount: { amountMinor, currency },
    description: 'Test',
    merchantName: null,
    bookedAt: D('2024-01-15'),
    createdAt: DT('2024-01-15T00:00:00Z'),
    ...extra,
  } as unknown as Transaction;
}

function makeMapping(txId: string, itemId: string): Mapping {
  return {
    id: id('m-1'),
    householdId: id('hh-1'),
    transactionId: id(txId),
    plannedItemId: id(itemId),
    createdByUserId: id('u-1'),
    createdAt: DT('2024-01-15T00:00:00Z'),
  };
}

function makeFxRate(base: CurrencyCode, quote: CurrencyCode, rate: number): FxRate {
  return {
    id: id('fx-1'),
    baseCurrency: base,
    quoteCurrency: quote,
    rate,
    rateDate: D('2024-01-31'),
    source: 'ecb',
    fetchedAt: DT('2024-01-31T16:30:00Z'),
  };
}

const emptyFx: FxRateTable = new Map();

describe('computeLeftover', () => {
  it('returns full leftover when no transactions', () => {
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [],
      mappings: [],
      fxTable: emptyFx,
      clock: CLOCK,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.leftover.amountMinor).toBe(10000n);
  });

  it('returns partial leftover when partially spent', () => {
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [makeTx('tx-1', 6000n)],
      mappings: [makeMapping('tx-1', 'item-1')],
      fxTable: emptyFx,
      clock: CLOCK,
    });
    expect(entries[0]!.leftover.amountMinor).toBe(4000n);
  });

  it('returns 0 leftover (not negative) when over-budget — PRD §4.8', () => {
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [makeTx('tx-1', 15000n)],
      mappings: [makeMapping('tx-1', 'item-1')],
      fxTable: emptyFx,
      clock: CLOCK,
    });
    expect(entries[0]!.leftover.amountMinor).toBe(0n);
    expect(entries[0]!.leftover.amountMinor >= 0n).toBe(true);
  });

  it('excludes ignored transactions', () => {
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [makeTx('tx-1', 10000n, 'PLN', { ignored: true })],
      mappings: [makeMapping('tx-1', 'item-1')],
      fxTable: emptyFx,
      clock: CLOCK,
    });
    expect(entries[0]!.leftover.amountMinor).toBe(10000n);
  });

  it('excludes active transfer transactions', () => {
    const transfer: Transfer = {
      id: id('tr-1'),
      householdId: id('hh-1'),
      fromTransactionId: id('tx-1'),
      toTransactionId: id('tx-2'),
      status: 'active',
      createdAt: DT('2024-01-15T00:00:00Z'),
    };
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [makeTx('tx-1', 10000n)],
      mappings: [makeMapping('tx-1', 'item-1')],
      transfers: [transfer],
      fxTable: emptyFx,
      clock: CLOCK,
    });
    expect(entries[0]!.leftover.amountMinor).toBe(10000n);
  });

  it('respects clock() — no Date.now() inside', () => {
    const customClock = (): IsoDate => D('2024-06-30');
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [],
      mappings: [],
      fxTable: emptyFx,
      clock: customClock,
    });
    expect(entries[0]!.asOf).toBe('2024-06-30');
  });

  it('converts foreign-currency transactions to base currency', () => {
    const rates: FxRateTable = new Map([['EUR/PLN', makeFxRate('EUR', 'PLN', 4.0)]]);
    // Planned: 10000 PLN. Spent: 1000 EUR = 4000 PLN. Leftover: 6000 PLN.
    const entries = computeLeftover({
      plan: makePlan(),
      plannedItems: [makeItem('item-1', 10000n)],
      transactions: [makeTx('tx-1', 1000n, 'EUR')],
      mappings: [makeMapping('tx-1', 'item-1')],
      fxTable: rates,
      clock: CLOCK,
    });
    expect(entries[0]!.leftover.amountMinor).toBe(6000n);
    expect(entries[0]!.actualAmount.amountMinor).toBe(4000n);
  });
});

describe('convertMoney', () => {
  it('returns same money when currencies match', () => {
    const money = { amountMinor: 1000n, currency: 'PLN' as const };
    const result = convertMoney(money, 'PLN', new Map());
    expect(result).toBe(money);
  });

  it('converts using direct rate', () => {
    const rates: FxRateTable = new Map([['EUR/PLN', makeFxRate('EUR', 'PLN', 4.25)]]);
    const result = convertMoney({ amountMinor: 1000n, currency: 'EUR' }, 'PLN', rates);
    expect(result.amountMinor).toBe(4250n);
    expect(result.currency).toBe('PLN');
  });

  it('converts using inverse rate', () => {
    const rates: FxRateTable = new Map([['EUR/PLN', makeFxRate('EUR', 'PLN', 4.0)]]);
    // PLN → EUR: inverse of EUR/PLN
    const result = convertMoney({ amountMinor: 4000n, currency: 'PLN' }, 'EUR', rates);
    expect(result.amountMinor).toBe(1000n);
    expect(result.currency).toBe('EUR');
  });

  it('converts via EUR cross-rate pivot', () => {
    const rates: FxRateTable = new Map([
      ['PLN/EUR', makeFxRate('PLN', 'EUR', 0.25)], // 1 PLN = 0.25 EUR
      ['EUR/USD', makeFxRate('EUR', 'USD', 1.1)], // 1 EUR = 1.10 USD
    ]);
    // 1000 PLN → 250 EUR → 275 USD
    const result = convertMoney({ amountMinor: 1000n, currency: 'PLN' }, 'USD', rates);
    expect(result.amountMinor).toBe(275n);
    expect(result.currency).toBe('USD');
  });

  it('throws UnknownCurrencyPairError for unknown pair', () => {
    expect(() => convertMoney({ amountMinor: 1000n, currency: 'PLN' }, 'USD', new Map())).toThrow(
      UnknownCurrencyPairError,
    );
  });

  it('uses only bigint math — result type is bigint', () => {
    const rates: FxRateTable = new Map([['EUR/PLN', makeFxRate('EUR', 'PLN', 4.25)]]);
    const result = convertMoney({ amountMinor: 100n, currency: 'EUR' }, 'PLN', rates);
    expect(typeof result.amountMinor).toBe('bigint');
  });
});

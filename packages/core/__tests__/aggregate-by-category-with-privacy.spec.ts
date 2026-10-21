import { describe, it, expect } from 'vitest';
import { aggregateByCategoryWithPrivacy } from '../src/logic/aggregate-by-category-with-privacy.js';
import type { AggregateByCategoryParams } from '../src/logic/aggregate-by-category-with-privacy.js';
import type { Category } from '../src/domain/categories/entities.js';
import type { CategoryPrivacyLevel } from '../src/domain/categories/enums.js';
import type { Transaction, Transfer } from '../src/domain/transactions/entities.js';
import type { FxRate, FxRateTable } from '../src/domain/currency/entities.js';
import type { CategoryId } from '../src/domain/categories/ids.js';
import type { TransactionId } from '../src/domain/transactions/ids.js';
import type { UserId } from '../src/domain/auth/ids.js';
import type { CurrencyCode } from '../src/domain/shared/currency.js';
import type { IsoDate, IsoDateTime } from '../src/domain/shared/ids.js';

// Cast helper — tests use readable string IDs instead of UUIDv7.
const id = <T>(s: string): T => s as unknown as T;

const VIEWER = id<UserId>('user-1');
const PARTNER = id<UserId>('user-2');
const CAT = id<CategoryId>('cat-1');

function makeCat(idStr: string, overrides?: Partial<Category>): Category {
  return {
    id: id(idStr),
    householdId: id('hh-1'),
    name: 'Test',
    kind: 'expense',
    sortOrder: 0,
    isSystem: false,
    createdAt: id<IsoDateTime>('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeTx(
  idStr: string,
  amountMinor: bigint,
  overrides: Partial<Transaction> & { currency?: CurrencyCode } = {},
): Transaction {
  const { currency = 'PLN', ...rest } = overrides;

  return {
    id: id(idStr),
    householdId: id('hh-1'),
    accountId: id('acc-1'),
    externalId: null,
    source: 'bank',
    status: 'posted',
    amount: { amountMinor, currency },
    description: 'Coffee',
    merchantName: 'Starbucks',
    bookedAt: id<IsoDate>('2024-01-15'),
    createdAt: id<IsoDateTime>('2024-01-15T00:00:00Z'),
    ignored: false,
    ...rest,
  };
}

function eurPln(rate: string): FxRateTable {
  const fx: FxRate = {
    id: id('fx-1'),
    baseCurrency: 'EUR',
    quoteCurrency: 'PLN',
    rate,
    rateDate: id('2024-01-31'),
    source: 'ecb',
    fetchedAt: id('2024-01-31T16:00:00Z'),
  };

  return new Map([['EUR/PLN', fx]]);
}

/** Every transaction is mapped to cat-1 and owned by `owners[txId]` (default: the viewer). */
function aggregate(
  transactions: readonly Transaction[],
  overrides: Partial<AggregateByCategoryParams> & {
    level?: CategoryPrivacyLevel;
    owners?: Record<string, UserId>;
  } = {},
): ReturnType<typeof aggregateByCategoryWithPrivacy> {
  const { level, owners = {}, ...rest } = overrides;

  return aggregateByCategoryWithPrivacy({
    transactions,
    txCategoryMap: new Map(transactions.map((tx) => [tx.id, CAT])),
    txOwnerMap: new Map(transactions.map((tx) => [tx.id, owners[tx.id] ?? VIEWER])),
    categories: [makeCat('cat-1')],
    viewerUserId: VIEWER,
    privacyMap: level === undefined ? new Map() : new Map([[CAT, level]]),
    transfers: [],
    period: { start: id('2024-01-01'), end: id('2024-01-31') },
    baseCurrency: 'PLN',
    fxTable: new Map(),
    ...rest,
  });
}

describe('aggregateByCategoryWithPrivacy', () => {
  const own = makeTx('tx-own', -500n, { description: 'My coffee' });
  const partner = makeTx('tx-partner', -300n, { description: 'Her lunch' });
  const owners = { 'tx-partner': PARTNER };

  describe('own transactions', () => {
    it('are always listed and counted, whatever the category level', () => {
      for (const level of ['full_detail', 'total_with_counts', 'total_only'] as const) {
        const agg = aggregate([own], { level })[0]!;

        expect(agg.transactionCount).toBe(1);
        expect(agg.transactions?.map((t) => t.description)).toEqual(['My coffee']);
      }
    });

    it('never carry the accountId', () => {
      const agg = aggregate([own], { level: 'full_detail' })[0]!;

      expect(agg.transactions![0]).not.toHaveProperty('accountId');
    });
  });

  describe("partner's transactions", () => {
    it('full_detail: counted and listed, without the account', () => {
      const agg = aggregate([own, partner], { level: 'full_detail', owners })[0]!;

      expect(agg.privacyLevel).toBe('full_detail');
      expect(agg.totalAmount).toEqual({ amountMinor: 800n, currency: 'PLN' });
      expect(agg.transactionCount).toBe(2);
      expect(agg.transactions?.map((t) => t.description)).toEqual(['My coffee', 'Her lunch']);
      expect(agg.transactions![1]).not.toHaveProperty('accountId');
    });

    it('total_with_counts: counted but not listed', () => {
      const agg = aggregate([own, partner], { level: 'total_with_counts', owners })[0]!;

      expect(agg.totalAmount.amountMinor).toBe(800n);
      expect(agg.transactionCount).toBe(2);
      expect(agg.transactions?.map((t) => t.description)).toEqual(['My coffee']);
    });

    it('total_only: only part of the total', () => {
      const agg = aggregate([own, partner], { level: 'total_only', owners })[0]!;

      expect(agg.totalAmount.amountMinor).toBe(800n);
      expect(agg.transactionCount).toBe(1);
      expect(agg.transactions?.map((t) => t.description)).toEqual(['My coffee']);
    });

    it('defaults to total_only when nobody configured the category', () => {
      const agg = aggregate([partner], { owners })[0]!;

      expect(agg.privacyLevel).toBe('total_only');
      expect(agg.totalAmount.amountMinor).toBe(300n);
      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });

    it('treats a transaction with no known owner as a partner transaction', () => {
      const agg = aggregateByCategoryWithPrivacy({
        transactions: [partner],
        txCategoryMap: new Map([[partner.id, CAT]]),
        txOwnerMap: new Map(),
        categories: [makeCat('cat-1')],
        viewerUserId: VIEWER,
        privacyMap: new Map(),
        transfers: [],
        period: { start: id('2024-01-01'), end: id('2024-01-31') },
        baseCurrency: 'PLN',
        fxTable: new Map(),
      })[0]!;

      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });
  });

  describe('totals', () => {
    it('signs expense totals so a refund reduces the spend', () => {
      const refund = makeTx('tx-refund', 200n);

      expect(aggregate([own, refund])[0]!.totalAmount.amountMinor).toBe(300n);
    });

    it('keeps income totals as inflows', () => {
      const salary = makeTx('tx-salary', 900_000n);
      const agg = aggregate([salary], { categories: [makeCat('cat-1', { kind: 'income' })] })[0]!;

      expect(agg.totalAmount.amountMinor).toBe(900_000n);
    });

    it('converts mixed currencies into the base currency instead of throwing', () => {
      const eur = makeTx('tx-eur', -1000n, { currency: 'EUR' });
      const agg = aggregate([own, eur], { fxTable: eurPln('4.25') })[0]!;

      expect(agg.totalAmount).toEqual({ amountMinor: 4750n, currency: 'PLN' });
      expect(agg.transactions?.map((t) => t.amount)).toEqual([
        { amountMinor: -500n, currency: 'PLN' },
        { amountMinor: -4250n, currency: 'PLN' },
      ]);
    });

    it('uses the base currency for an empty category', () => {
      const agg = aggregate([], { baseCurrency: 'EUR' })[0]!;

      expect(agg.totalAmount).toEqual({ amountMinor: 0n, currency: 'EUR' });
      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });

    it('leaves out ignored, cancelled, transferred and out-of-period transactions', () => {
      const ignored = makeTx('tx-ignored', -100n, { ignored: true });
      const cancelled = makeTx('tx-cancelled', -100n, { status: 'cancelled' });
      const transferred = makeTx('tx-transfer', -100n);
      const outside = makeTx('tx-feb', -100n, { bookedAt: id('2024-02-01') });
      const transfer: Transfer = {
        id: id('tr-1'),
        householdId: id('hh-1'),
        fromTransactionId: transferred.id,
        toTransactionId: null,
        status: 'active',
        createdAt: id('2024-01-15T00:00:00Z'),
      };
      const agg = aggregate([own, ignored, cancelled, transferred, outside], {
        transfers: [transfer],
      })[0]!;

      expect(agg.totalAmount.amountMinor).toBe(500n);
      expect(agg.transactionCount).toBe(1);
    });
  });

  it('segregates transactions into their categories and keeps empty ones', () => {
    const food = makeTx('tx-food', -200n);
    const result = aggregateByCategoryWithPrivacy({
      transactions: [own, food],
      txCategoryMap: new Map<TransactionId, CategoryId>([
        [own.id, id('cat-1')],
        [food.id, id('cat-2')],
      ]),
      txOwnerMap: new Map([
        [own.id, VIEWER],
        [food.id, VIEWER],
      ]),
      categories: [makeCat('cat-1'), makeCat('cat-2'), makeCat('cat-3')],
      viewerUserId: VIEWER,
      privacyMap: new Map(),
      transfers: [],
      period: { start: id('2024-01-01'), end: id('2024-01-31') },
      baseCurrency: 'PLN',
      fxTable: new Map(),
    });

    expect(result.map((a) => [a.categoryId, a.totalAmount.amountMinor])).toEqual([
      ['cat-1', 500n],
      ['cat-2', 200n],
      ['cat-3', 0n],
    ]);
  });
});

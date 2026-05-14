import { describe, it, expect } from 'vitest';
import { aggregateByCategoryWithPrivacy } from '../src/logic/aggregate-by-category-with-privacy.js';
import type { Category } from '../src/domain/categories/entities.js';
import type { Transaction } from '../src/domain/transactions/entities.js';
import type { CategoryId } from '../src/domain/categories/ids.js';
import type { TransactionId } from '../src/domain/transactions/ids.js';
import type { UserId } from '../src/domain/auth/ids.js';
import type { IsoDate, IsoDateTime } from '../src/domain/shared/ids.js';

// Cast helper — tests use readable string IDs instead of UUIDv7.
const id = <T>(s: string): T => s as unknown as T;

function makeCat(idStr: string, overrides?: Partial<Category>): Category {
  return {
    id: id(idStr),
    householdId: id('hh-1'),
    name: 'Test',
    kind: 'expense',
    sortOrder: 0,
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z' as unknown as IsoDateTime,
    ...overrides,
  };
}

function makeTx(idStr: string, amountMinor: bigint): Transaction {
  return {
    id: id(idStr),
    householdId: id('hh-1'),
    accountId: id('acc-1'),
    externalId: null,
    source: 'bank',
    status: 'posted',
    amount: { amountMinor, currency: 'PLN' },
    description: 'Coffee',
    merchantName: 'Starbucks',
    bookedAt: '2024-01-15' as unknown as IsoDate,
    createdAt: '2024-01-15T00:00:00Z' as unknown as IsoDateTime,
  };
}

const VIEWER_OWN = id<UserId>('user-1');
const VIEWER_PARTNER = id<UserId>('user-2');

describe('aggregateByCategoryWithPrivacy', () => {
  const cat = makeCat('cat-1');
  const tx1 = makeTx('tx-1', 500n);
  const tx2 = makeTx('tx-2', 300n);
  const txCatMap = new Map<TransactionId, CategoryId>([
    [id('tx-1'), id('cat-1')],
    [id('tx-2'), id('cat-1')],
  ]);

  describe('full_detail', () => {
    it('returns transactions without accountId (own user)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx2],
        txCategoryMap: txCatMap,
        categories: [cat],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map([[id('cat-1'), 'full_detail']]),
      });

      expect(result).toHaveLength(1);
      const agg = result[0]!;
      expect(agg.privacyLevel).toBe('full_detail');
      expect(agg.totalAmount.amountMinor).toBe(800n);
      expect(agg.transactionCount).toBe(2);
      expect(agg.transactions).toHaveLength(2);
      // accountId must never appear in TransactionSummary
      for (const txSummary of agg.transactions!) {
        expect(txSummary).not.toHaveProperty('accountId');
      }
    });

    it('returns transactions without accountId (partner view)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1],
        txCategoryMap: new Map([[id<TransactionId>('tx-1'), id<CategoryId>('cat-1')]]),
        categories: [cat],
        viewerUserId: VIEWER_PARTNER,
        privacyMap: new Map([[id('cat-1'), 'full_detail']]),
      });

      const agg = result[0]!;
      expect(agg.transactions).toHaveLength(1);
      expect(agg.transactions![0]).not.toHaveProperty('accountId');
    });

    it('returns empty transactions array shape when no txs mapped', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [],
        txCategoryMap: new Map(),
        categories: [cat],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map([[id('cat-1'), 'full_detail']]),
      });

      const agg = result[0]!;
      expect(agg.totalAmount.amountMinor).toBe(0n);
      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });
  });

  describe('total_with_counts', () => {
    it('returns count but no transaction list (own user)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx2],
        txCategoryMap: txCatMap,
        categories: [cat],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map([[id('cat-1'), 'total_with_counts']]),
      });

      const agg = result[0]!;
      expect(agg.privacyLevel).toBe('total_with_counts');
      expect(agg.totalAmount.amountMinor).toBe(800n);
      expect(agg.transactionCount).toBe(2);
      expect(agg.transactions).toBeUndefined();
    });

    it('returns count but no transaction list (partner view)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx2],
        txCategoryMap: txCatMap,
        categories: [cat],
        viewerUserId: VIEWER_PARTNER,
        privacyMap: new Map([[id('cat-1'), 'total_with_counts']]),
      });

      const agg = result[0]!;
      expect(agg.transactionCount).toBe(2);
      expect(agg.transactions).toBeUndefined();
    });
  });

  describe('total_only', () => {
    it('returns only total; count is 0 and no list (own user)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx2],
        txCategoryMap: txCatMap,
        categories: [cat],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map([[id('cat-1'), 'total_only']]),
      });

      const agg = result[0]!;
      expect(agg.privacyLevel).toBe('total_only');
      expect(agg.totalAmount.amountMinor).toBe(800n);
      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });

    it('returns only total; count is 0 and no list (partner view)', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx2],
        txCategoryMap: txCatMap,
        categories: [cat],
        viewerUserId: VIEWER_PARTNER,
        privacyMap: new Map([[id('cat-1'), 'total_only']]),
      });

      const agg = result[0]!;
      expect(agg.transactionCount).toBe(0);
      expect(agg.transactions).toBeUndefined();
    });
  });

  describe('default privacy level', () => {
    it('defaults to full_detail when category is absent from privacyMap', () => {
      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1],
        txCategoryMap: new Map([[id<TransactionId>('tx-1'), id<CategoryId>('cat-1')]]),
        categories: [cat],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map(), // empty — no override
      });

      expect(result[0]!.privacyLevel).toBe('full_detail');
      expect(result[0]!.transactions).toHaveLength(1);
    });
  });

  describe('privacy demotion — information monotonicity', () => {
    it('full→total_with_counts reduces information (transactions disappear)', () => {
      const params = (level: 'full_detail' | 'total_with_counts' | 'total_only') =>
        aggregateByCategoryWithPrivacy({
          transactions: [tx1, tx2],
          txCategoryMap: txCatMap,
          categories: [cat],
          viewerUserId: VIEWER_PARTNER,
          privacyMap: new Map([[id('cat-1'), level]]),
        })[0]!;

      const full = params('full_detail');
      const withCounts = params('total_with_counts');
      const totalOnly = params('total_only');

      // full_detail has more info: transaction list present
      expect(full.transactions).toBeDefined();
      expect(withCounts.transactions).toBeUndefined();

      // total_with_counts has more info than total_only: count is non-zero
      expect(withCounts.transactionCount).toBeGreaterThan(0);
      expect(totalOnly.transactionCount).toBe(0);

      // Total amount is identical across all levels
      expect(full.totalAmount.amountMinor).toBe(withCounts.totalAmount.amountMinor);
      expect(withCounts.totalAmount.amountMinor).toBe(totalOnly.totalAmount.amountMinor);
    });
  });

  describe('multiple categories', () => {
    it('correctly segregates transactions into separate categories', () => {
      const cat2 = makeCat('cat-2', { name: 'Food' });
      const tx3 = makeTx('tx-3', 200n);
      const multiMap = new Map<TransactionId, CategoryId>([
        [id('tx-1'), id('cat-1')],
        [id('tx-3'), id('cat-2')],
      ]);

      const result = aggregateByCategoryWithPrivacy({
        transactions: [tx1, tx3],
        txCategoryMap: multiMap,
        categories: [cat, cat2],
        viewerUserId: VIEWER_OWN,
        privacyMap: new Map([
          [id('cat-1'), 'full_detail'],
          [id('cat-2'), 'total_only'],
        ]),
      });

      expect(result).toHaveLength(2);
      const agg1 = result.find((a) => a.categoryId === id<CategoryId>('cat-1'))!;
      const agg2 = result.find((a) => a.categoryId === id<CategoryId>('cat-2'))!;

      expect(agg1.totalAmount.amountMinor).toBe(500n);
      expect(agg1.transactions).toHaveLength(1);

      expect(agg2.totalAmount.amountMinor).toBe(200n);
      expect(agg2.transactionCount).toBe(0); // total_only
      expect(agg2.transactions).toBeUndefined();
    });
  });
});

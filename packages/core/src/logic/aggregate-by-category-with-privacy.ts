import type {
  Category,
  CategoryAggregate,
  TransactionSummary,
} from '../domain/categories/entities.js';
import type { CategoryPrivacyLevel } from '../domain/categories/enums.js';
import type { Transaction, Transfer } from '../domain/transactions/entities.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { UserId } from '../domain/auth/ids.js';
import type { CategoryId } from '../domain/categories/ids.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import type { DateRange } from '../domain/shared/date-range.js';
import { Money } from '../domain/shared/money.js';
import { convertMoney } from './convert-money.js';
import { countedTransactions, directedSumMinor } from './counted-transactions.js';

/** Maps category ID → the level of detail a partner may see (set by the category's owner). */
export type PrivacyMap = ReadonlyMap<CategoryId, CategoryPrivacyLevel>;

/**
 * Pre-resolved map from transaction ID → category ID.
 * The application layer builds this by walking: transaction → mapping → planned item → category.
 */
export type TxCategoryMap = ReadonlyMap<TransactionId, CategoryId>;

/** Transaction ID → the user who owns the account it was booked on. */
export type TxOwnerMap = ReadonlyMap<TransactionId, UserId>;

/** What a partner sees of a category nobody configured (PRODUCT §4.9: most private). */
export const DEFAULT_PARTNER_PRIVACY_LEVEL: CategoryPrivacyLevel = 'total_only';

export interface AggregateByCategoryParams {
  transactions: readonly Transaction[];
  /** Transaction-to-category resolution, pre-computed by the application layer. */
  txCategoryMap: TxCategoryMap;
  /** Owner of every transaction; a transaction with no known owner is treated as a partner's. */
  txOwnerMap: TxOwnerMap;
  categories: readonly Category[];
  viewerUserId: UserId;
  privacyMap: PrivacyMap;
  transfers: readonly Transfer[];
  /** Only transactions booked in this range count. */
  period: DateRange;
  /** Every total is converted into this currency. */
  baseCurrency: CurrencyCode;
  fxTable: FxRateTable;
}

interface OwnerSplit {
  readonly own: readonly Transaction[];
  readonly partner: readonly Transaction[];
}

function groupByCategory(
  transactions: readonly Transaction[],
  txCategoryMap: TxCategoryMap,
): Map<CategoryId, Transaction[]> {
  const txsByCategory = new Map<CategoryId, Transaction[]>();
  for (const tx of transactions) {
    const catId = txCategoryMap.get(tx.id);
    if (catId === undefined) {
      continue;
    }
    const bucket = txsByCategory.get(catId) ?? [];
    bucket.push(tx);
    txsByCategory.set(catId, bucket);
  }

  return txsByCategory;
}

function splitByOwner(
  transactions: readonly Transaction[],
  txOwnerMap: TxOwnerMap,
  viewerUserId: UserId,
): OwnerSplit {
  const own: Transaction[] = [];
  const partner: Transaction[] = [];
  for (const tx of transactions) {
    if (txOwnerMap.get(tx.id) === viewerUserId) {
      own.push(tx);
    } else {
      partner.push(tx);
    }
  }

  return { own, partner };
}

function toSummary(tx: Transaction, base: CurrencyCode, fxTable: FxRateTable): TransactionSummary {
  // accountId intentionally absent — never leaked
  return {
    transactionId: tx.id,
    merchantName: tx.merchantName,
    description: tx.description,
    amount: convertMoney(tx.amount, base, fxTable),
    bookedAt: tx.bookedAt,
  };
}

/**
 * Aggregate transactions by category with per-owner privacy. The viewer always
 * sees their own transactions in full. A partner's transactions are shown at
 * the level set for the category (default total-only):
 * - full_detail:       counted and listed (accountId never included)
 * - total_with_counts: counted, not listed
 * - total_only:        only part of the total
 *
 * Totals include everyone's transactions, are converted into the base currency
 * and are signed by the category kind (refunds reduce an expense total).
 * Ignored transactions, transfers and transactions outside the period are left
 * out. Categories with no mapped transactions are included with a zero total.
 * Unmapped transactions are excluded (the caller handles the "unplanned" bucket).
 */
export function aggregateByCategoryWithPrivacy({
  transactions,
  txCategoryMap,
  txOwnerMap,
  categories,
  viewerUserId,
  privacyMap,
  transfers,
  period,
  baseCurrency,
  fxTable,
}: AggregateByCategoryParams): CategoryAggregate[] {
  const counted = countedTransactions(transactions, transfers, period);
  const txsByCategory = groupByCategory(counted, txCategoryMap);

  return categories.map((category): CategoryAggregate => {
    const txs = txsByCategory.get(category.id) ?? [];
    const level = privacyMap.get(category.id) ?? DEFAULT_PARTNER_PRIVACY_LEVEL;
    const { own, partner } = splitByOwner(txs, txOwnerMap, viewerUserId);
    const visiblePartnerCount = level === 'total_only' ? 0 : partner.length;
    const listed = level === 'full_detail' ? [...own, ...partner] : own;
    const summaries = listed.map((tx) => toSummary(tx, baseCurrency, fxTable));

    return {
      categoryId: category.id,
      category,
      totalAmount: Money.of(
        directedSumMinor(category.kind, txs, baseCurrency, fxTable),
        baseCurrency,
      ),
      transactionCount: own.length + visiblePartnerCount,
      privacyLevel: level,
      ...(summaries.length > 0 ? { transactions: summaries } : {}),
    };
  });
}

import type {
  Category,
  CategoryAggregate,
  TransactionSummary,
} from '../domain/categories/entities.js';
import type { CategoryPrivacyLevel } from '../domain/categories/enums.js';
import type { Transaction } from '../domain/transactions/entities.js';
import type { UserId } from '../domain/auth/ids.js';
import type { CategoryId } from '../domain/categories/ids.js';
import type { TransactionId } from '../domain/transactions/ids.js';
import { Money } from '../domain/shared/money.js';

/** Maps category ID → privacy level for a specific viewer. */
export type PrivacyMap = ReadonlyMap<CategoryId, CategoryPrivacyLevel>;

/**
 * Pre-resolved map from transaction ID → category ID.
 * The application layer builds this by walking: transaction → mapping → planned item → category.
 */
export type TxCategoryMap = ReadonlyMap<TransactionId, CategoryId>;

export interface AggregateByCategoryParams {
  transactions: readonly Transaction[];
  /** Transaction-to-category resolution, pre-computed by the application layer. */
  txCategoryMap: TxCategoryMap;
  categories: readonly Category[];
  viewerUserId: UserId;
  privacyMap: PrivacyMap;
}

/**
 * Aggregate transactions by category, applying per-category privacy rules.
 *
 * Privacy levels:
 * - full_detail:       total + count + transaction list (accountId never included)
 * - total_with_counts: total + count, no transaction list
 * - total_only:        total amount only; transactionCount is 0, no list
 *
 * Categories with no mapped transactions are included with a zero total.
 * Unmapped transactions are silently excluded (caller handles the "unplanned" bucket).
 */
export function aggregateByCategoryWithPrivacy({
  transactions,
  txCategoryMap,
  categories,
  privacyMap,
}: AggregateByCategoryParams): CategoryAggregate[] {
  // Group transactions by category ID.
  const txsByCategory = new Map<CategoryId, Transaction[]>();
  for (const tx of transactions) {
    const catId = txCategoryMap.get(tx.id);
    if (catId === undefined) continue;
    let bucket = txsByCategory.get(catId);
    if (bucket === undefined) {
      bucket = [];
      txsByCategory.set(catId, bucket);
    }
    bucket.push(tx);
  }

  return categories.map((category): CategoryAggregate => {
    const txs = txsByCategory.get(category.id) ?? [];
    const level: CategoryPrivacyLevel = privacyMap.get(category.id) ?? 'full_detail';

    // Accumulate total using Money.add so currency mismatches throw.
    // Default to PLN when the category has no transactions.
    let total = Money.zero(txs[0]?.amount.currency ?? 'PLN');
    const txSummaries: TransactionSummary[] = [];

    for (const tx of txs) {
      total = Money.add(total, tx.amount);
      if (level === 'full_detail') {
        txSummaries.push({
          transactionId: tx.id,
          merchantName: tx.merchantName,
          description: tx.description,
          amount: tx.amount,
          bookedAt: tx.bookedAt,
          // accountId intentionally absent — never leaked
        });
      }
    }

    return {
      categoryId: category.id,
      category,
      totalAmount: total,
      transactionCount: level === 'total_only' ? 0 : txs.length,
      privacyLevel: level,
      ...(level === 'full_detail' && txSummaries.length > 0 ? { transactions: txSummaries } : {}),
    };
  });
}

import type { CategoryId, CategoryPrivacyId } from './ids.js';
import type { CategoryPrivacyLevel } from './enums.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';
import type { Money } from '../shared/money.js';
import type { TransactionId } from '../transactions/ids.js';

export type CategoryKind = 'income' | 'expense';

export interface Category {
  readonly id: CategoryId;
  readonly householdId: HouseholdId | null;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly sortOrder: number;
  readonly isSystem: boolean;
  readonly createdAt: IsoDateTime;
}

export interface CategoryPrivacy {
  readonly id: CategoryPrivacyId;
  readonly categoryId: CategoryId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly level: CategoryPrivacyLevel;
  readonly updatedAt: IsoDateTime;
}

/**
 * A single transaction summary included in full_detail aggregates.
 * accountId is intentionally absent — never leaked at any privacy level.
 */
export interface TransactionSummary {
  readonly transactionId: TransactionId;
  readonly merchantName: string | null;
  readonly description: string;
  readonly amount: Money;
  readonly bookedAt: IsoDate;
}

export interface CategoryAggregate {
  readonly categoryId: CategoryId;
  readonly category: Category;
  readonly totalAmount: Money;
  /** The viewer's own transactions, plus the partner's unless privacyLevel is total_only. */
  readonly transactionCount: number;
  /** The viewer's own transactions, plus the partner's when privacyLevel is full_detail; absent when empty. */
  readonly transactions?: readonly TransactionSummary[];
  /** The level applied to the partner's transactions in this category. */
  readonly privacyLevel: CategoryPrivacyLevel;
}

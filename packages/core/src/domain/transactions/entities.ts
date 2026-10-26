import type { TransactionId, TransactionMappingId, TransferId } from './ids.js';
import type { TransactionSource } from './enums.js';
import type { BankAccountId } from '../bank/ids.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { PlannedItemId } from '../plans/ids.js';
import type { Money } from '../shared/money.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

/**
 * Row lifecycle (plan-banking.md §1.7): `live` comes from a live signal only, `pending` is
 * EB `PDNG`/`HOLD`, `booked` is EB `BOOK`, `cancelled` is EB `CNCL`/`RJCT` or a withdrawn
 * pending row, `expired` is a provisional row with no booked match after 10 days, `manual`
 * is entered by a user.
 */
export const TRANSACTION_STATUSES = [
  'live',
  'pending',
  'booked',
  'cancelled',
  'expired',
  'manual',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Provisional rows wait for their booked counterpart (reconciliation, plan-banking.md §1.7). */
export const PROVISIONAL_TRANSACTION_STATUSES = ['live', 'pending'] as const;
export type ProvisionalTransactionStatus = (typeof PROVISIONAL_TRANSACTION_STATUSES)[number];

/** Kept for audit but excluded from every total and from the dashboard. */
export const UNCOUNTED_TRANSACTION_STATUSES = ['cancelled', 'expired'] as const;

export function isCountedTransactionStatus(status: TransactionStatus): boolean {
  return !UNCOUNTED_TRANSACTION_STATUSES.some((uncounted) => uncounted === status);
}

export interface Transaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  readonly source: TransactionSource;
  readonly status: TransactionStatus;
  readonly amount: Money;
  readonly description: string;
  readonly merchantName: string | null;
  readonly bookedAt: IsoDate;
  readonly createdAt: IsoDateTime;
  /** Excluded from every total when true. */
  readonly ignored: boolean;
}

export interface Mapping {
  readonly id: TransactionMappingId;
  readonly householdId: HouseholdId;
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId;
  readonly createdByUserId: UserId;
  readonly createdAt: IsoDateTime;
}

export type TransferStatus = 'active' | 'reversed';

export interface Transfer {
  readonly id: TransferId;
  readonly householdId: HouseholdId;
  readonly fromTransactionId: TransactionId;
  /** Null when the counterpart account is not connected (a one-sided transfer). */
  readonly toTransactionId: TransactionId | null;
  readonly status: TransferStatus;
  readonly createdAt: IsoDateTime;
}

import type { MinorUnitAmount } from '@power-budget/core';

/** Who chose the planned item of a mapped transaction. */
export type MappedBy = 'manual' | 'rule' | 'ai';

export interface TransactionMapping {
  plannedItemId: string;
  /** Empty when only the id is known (the detail endpoint returns no names). */
  planName: string;
  planArchived: boolean;
  /** Empty when only the id is known, or the category row is missing. */
  categoryName: string;
  by: MappedBy;
}

export type TransactionSource = 'bank_sync' | 'manual';

/**
 * Row lifecycle (plan-banking.md §1.7): `live` and `pending` until the bank books the row,
 * `cancelled` and `expired` rows count in no total, `manual` rows are entered by a user.
 */
export type TransactionStatus = 'live' | 'pending' | 'booked' | 'cancelled' | 'expired' | 'manual';

/** A transaction as the web screens use it; built from the API DTO by TransactionMapper. */
export interface Transaction {
  id: string;
  accountId: string;
  /** Calendar date, 'YYYY-MM-DD'. */
  occurredOn: string;
  /** Exact minor units; the API sends them as an integer string (CLN-002). */
  amount: MinorUnitAmount;
  description: string;
  merchant: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  /** Planned item the API proposes for an unmapped transaction. */
  suggestedPlannedItemId: string | null;
  isTransfer: boolean;
  ignored: boolean;
  notes: string | null;
  mapping: TransactionMapping | null;
}

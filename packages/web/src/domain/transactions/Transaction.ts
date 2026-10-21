import type { MinorUnitAmount } from '@power-budget/core';

export interface TransactionMapping {
  plannedItemId: string;
  /** Empty until the API returns planned-item details with the mapping. */
  plannedItemName: string;
  categoryId: string;
  categoryName: string;
}

export type TransactionSource = 'bank_sync' | 'manual';

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
  isTransfer: boolean;
  ignored: boolean;
  notes: string | null;
  mapping: TransactionMapping | null;
}

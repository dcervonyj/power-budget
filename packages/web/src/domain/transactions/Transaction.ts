import type { MinorUnitAmount } from '@power-budget/core';

export interface TransactionMapping {
  plannedItemId: string;
  /** Empty until the API returns planned-item details with the mapping. */
  plannedItemName: string;
  categoryId: string;
  categoryName: string;
}

export type TransactionSource = 'bank_sync' | 'manual';

/** Lifecycle of the bank record: pending until the bank books it. */
export type TransactionStatus = 'pending' | 'posted' | 'cancelled';

/**
 * The list endpoint does not say whether a transaction is mapped; it is only
 * known from the detail endpoint or from an `unmappedOnly` query.
 */
export type MappingStatus = 'mapped' | 'unmapped' | 'unknown';

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
  /** Planned item the API proposes for an unmapped transaction (no AI/rule provenance yet). */
  suggestedPlannedItemId: string | null;
  isTransfer: boolean;
  ignored: boolean;
  notes: string | null;
  mapping: TransactionMapping | null;
  mappingStatus: MappingStatus;
}

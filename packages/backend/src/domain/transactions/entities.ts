import type {
  TransactionId,
  TransactionMappingId,
  TransferId,
  BankAccountId,
  CategoryId,
  CurrencyCode,
  HouseholdId,
  UserId,
  PlanId,
  PlannedItemId,
  Money,
  IsoDate,
  IsoDateTime,
} from '@power-budget/core';

export type TransactionSource = 'bank_sync' | 'manual';
/** Booking state; `posted` is the bank's booked state (Enable Banking `BOOK`). */
export type TransactionStatus = 'pending' | 'posted' | 'cancelled';
export const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'pending',
  'posted',
  'cancelled',
];
export type TransferStatus = 'active' | 'reversed';

/**
 * Who decided a stored mapping (`transaction_mappings.source`): a user, a learned rule
 * (merchant memory, planned-item hint, transfer rule) or the AI classifier (M3).
 */
export type MappingOrigin = 'manual' | 'rule' | 'ai';
export const MAPPING_ORIGINS: readonly MappingOrigin[] = ['manual', 'rule', 'ai'];

/**
 * How a transaction got its planned item, as the list shows it: the origin of its mapping,
 * `suggestion` when it has no mapping but a suggested planned item waits for confirmation,
 * or `none`. Only `manual` and `none` occur until the M3 categorisation pipeline lands.
 */
export type MappingSource = MappingOrigin | 'suggestion' | 'none';
export const MAPPING_SOURCES: readonly MappingSource[] = [
  'manual',
  'rule',
  'ai',
  'suggestion',
  'none',
];

export interface Transaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly merchant: string | null;
  readonly source: TransactionSource;
  readonly status: TransactionStatus;
  readonly ignored: boolean;
  readonly notes: string | null;
  readonly suggestedPlannedItemId: PlannedItemId | null;
  readonly createdAt: IsoDateTime;
}

export interface NewTransaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly merchant: string | null;
  readonly source: TransactionSource;
  readonly status?: TransactionStatus;
}

/** An account the caller owns, as the manual-transaction checks need it. */
export interface OwnedAccountRef {
  readonly id: BankAccountId;
  readonly currency: CurrencyCode;
}

export interface NewManualTransaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly merchant: string | null;
  readonly notes: string | null;
}

export interface TransactionMapping {
  readonly id: TransactionMappingId;
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId;
  readonly householdId: HouseholdId;
  readonly mappedBy: UserId;
  readonly mappedAt: IsoDateTime;
}

export interface Transfer {
  readonly id: TransferId;
  readonly householdId: HouseholdId;
  readonly txAId: TransactionId;
  readonly txBId: TransactionId | null;
  readonly markedBy: UserId;
  readonly markedAt: IsoDateTime;
  readonly status: TransferStatus;
}

/** The planned item a listed transaction is mapped to, with names (archived plans included). */
export interface TransactionListMapping {
  readonly plannedItemId: PlannedItemId;
  readonly planId: PlanId;
  readonly planName: string;
  readonly planArchived: boolean;
  readonly categoryId: CategoryId;
  /** Null only when the category row is missing (`planned_items.category_id` has no FK). */
  readonly categoryName: string | null;
  /** Seed key of a system category, for localised names; null for household categories. */
  readonly categorySeedKey: string | null;
  readonly origin: MappingOrigin;
  readonly mappedAt: IsoDateTime;
}

/** The transfer a listed transaction belongs to; the counterpart is null for a standalone one. */
export interface TransactionTransferLink {
  readonly transferId: TransferId;
  readonly counterpartTransactionId: TransactionId | null;
}

/** One row of `GET /transactions`: the transaction plus its mapping and transfer state. */
export interface TransactionListItem {
  readonly transaction: Transaction;
  readonly mapping: TransactionListMapping | null;
  readonly mappingSource: MappingSource;
  readonly transfer: TransactionTransferLink | null;
}

export interface TransactionQuery {
  readonly householdId: HouseholdId;
  /**
   * Only transactions on this user's accounts: transactions are private to the account
   * owner, a partner sees them only as dashboard aggregates (PRODUCT §4.3, §4.9).
   */
  readonly ownerUserId: UserId;
  readonly accountId?: BankAccountId;
  readonly dateFrom?: IsoDate;
  readonly dateTo?: IsoDate;
  readonly search?: string;
  /** Only rows that still need attention: no mapping, not a transfer, not ignored. */
  readonly unmappedOnly?: boolean;
  readonly status?: TransactionStatus;
  /** Opaque keyset cursor returned as `nextCursor` by the previous page. */
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Page<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

/** Idempotency key used when externalId is absent */
export interface IngestHashInput {
  readonly accountId: BankAccountId;
  readonly occurredOn: IsoDate;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly normalisedDescription: string;
}

import type {
  BankTxDirection,
  DateRange,
  ProvisionalTransactionStatus,
  TransactionStatus,
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

export {
  TRANSACTION_STATUSES,
  PROVISIONAL_TRANSACTION_STATUSES,
  UNCOUNTED_TRANSACTION_STATUSES,
} from '@power-budget/core';
export type { TransactionStatus, ProvisionalTransactionStatus } from '@power-budget/core';

export type TransactionSource = 'bank_sync' | 'manual';

/** Where a row came from (plan-banking.md §1.10); NULL on bank rows that predate SYNC-001. */
export const TRANSACTION_SOURCE_KINDS = [
  'enable_banking',
  'wise_webhook',
  'pko_email',
  'iko_push',
  'manual',
] as const;
export type TransactionSourceKind = (typeof TRANSACTION_SOURCE_KINDS)[number];

/**
 * The `source` filter of `GET /transactions`: `bank_sync` and `manual` match the row's `source`
 * (every bank row, whichever provider or none, and manual rows); a provider value matches the
 * SYNC-001 `source_kind`, which bank rows ingested before it do not carry.
 */
export const TRANSACTION_SOURCE_FILTERS = ['bank_sync', ...TRANSACTION_SOURCE_KINDS] as const;
export type TransactionSourceFilter = (typeof TRANSACTION_SOURCE_FILTERS)[number];

/** What proposed the suggested planned item or category (plan-banking.md §1.13). */
export const SUGGESTION_SOURCES = [
  'transfer_rule',
  'planned_hint',
  'merchant_rule',
  'llm',
] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];
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

/**
 * What the bank (or a live signal) says about a row beyond amount and date (plan-banking.md
 * §1.10). Every field is optional at the source: manual rows and old rows have none.
 */
export interface BankTransactionDetails {
  readonly bookingDate: IsoDate | null;
  readonly valueDate: IsoDate | null;
  readonly transactionAt: IsoDateTime | null;
  readonly counterpartyName: string | null;
  /** A hash, never the IBAN itself. */
  readonly counterpartyIbanHash: string | null;
  readonly remittance: string | null;
  readonly mcc: string | null;
  readonly bankTxCode: string | null;
  /** Enable Banking `entry_reference`: the stable key of a booked row. */
  readonly entryReference: string | null;
  /** The matching key of a pending row (plan-banking.md §1.7). */
  readonly fingerprint: string | null;
  /** The instructed amount of an FX payment. */
  readonly originalAmount: Money | null;
}

export const NO_BANK_DETAILS: BankTransactionDetails = {
  bookingDate: null,
  valueDate: null,
  transactionAt: null,
  counterpartyName: null,
  counterpartyIbanHash: null,
  remittance: null,
  mcc: null,
  bankTxCode: null,
  entryReference: null,
  fingerprint: null,
  originalAmount: null,
};

/** A provisional row as it was right before an in-place upgrade. */
export interface ProvisionalSnapshot {
  readonly status: ProvisionalTransactionStatus;
  readonly externalId: string | null;
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly sourceKind: TransactionSourceKind | null;
  readonly fingerprint: string | null;
}

export interface TransactionUpgradeRecord {
  readonly upgradedAt: IsoDateTime;
  readonly from: ProvisionalSnapshot;
}

/** `transactions.reconciliation`: every in-place upgrade of the row, oldest first. */
export interface TransactionReconciliation {
  readonly upgrades: readonly TransactionUpgradeRecord[];
}

/** The categorisation suggestion stored on a row (plan-banking.md §1.13). */
export interface TransactionSuggestionFields {
  readonly suggestedPlannedItemId: PlannedItemId | null;
  readonly suggestedCategoryId: CategoryId | null;
  /** 0..1, three decimals (`numeric(4,3)`). */
  readonly suggestionConfidence: number | null;
  readonly suggestionSource: SuggestionSource | null;
  /** The mapping was applied automatically from the suggestion. */
  readonly autoMapped: boolean;
}

export interface Transaction extends TransactionSuggestionFields {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  /** The economic date: the transaction date if present, else the booking date. */
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly merchant: string | null;
  readonly source: TransactionSource;
  readonly sourceKind: TransactionSourceKind | null;
  readonly status: TransactionStatus;
  readonly direction: BankTxDirection;
  readonly bank: BankTransactionDetails;
  readonly reconciliation: TransactionReconciliation | null;
  readonly ignored: boolean;
  readonly notes: string | null;
  readonly createdAt: IsoDateTime;
}

/** An amount with the currency code as the bank sent it. */
export interface ReceivedAmount {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/** `direction` is a generated column: the sign of the amount. */
export interface NewTransaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  readonly occurredOn: IsoDate;
  /** The amount as received: the currency may be one the app does not support (see `ignored`). */
  readonly amount: ReceivedAmount;
  readonly description: string;
  readonly merchant: string | null;
  readonly source: TransactionSource;
  readonly sourceKind: TransactionSourceKind | null;
  readonly status: TransactionStatus;
  readonly bank: BankTransactionDetails;
  /** True for rows the app cannot count, e.g. an unsupported currency; reversible via the patch. */
  readonly ignored: boolean;
}

/** The statuses a provisional row can be upgraded to (plan-banking.md §1.7). */
export type UpgradeTargetStatus = 'pending' | 'booked';

/**
 * An in-place upgrade of a provisional row: live → pending, live → booked or
 * pending → booked. The row keeps its id, mapping, transfer link, suggestion and notes.
 */
export interface TransactionUpgrade {
  readonly id: TransactionId;
  readonly accountId: BankAccountId;
  readonly status: UpgradeTargetStatus;
  readonly externalId: string | null;
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly description: string;
  readonly sourceKind: TransactionSourceKind;
  readonly bank: BankTransactionDetails;
  readonly upgradedAt: IsoDateTime;
}

/** The provisional rows of one account whose economic date lies in `window` (inclusive). */
export interface ProvisionalQuery {
  readonly accountId: BankAccountId;
  readonly window: DateRange;
}

/** The suggestion fields a `patch` may change, plus the user-editable ones. */
export type TransactionPatch = Partial<
  Pick<Transaction, 'notes' | 'ignored'> & TransactionSuggestionFields
>;

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
  /** `true`: only rows with a mapping that are not a transfer and not ignored. */
  readonly mapped?: boolean;
  /** `true`: only transfers (not ignored); `false`: only rows that are not part of a transfer. */
  readonly transfer?: boolean;
  readonly status?: TransactionStatus;
  /** Only rows mapped to a planned item of this category. */
  readonly categoryId?: CategoryId;
  readonly currency?: CurrencyCode;
  readonly source?: TransactionSourceFilter;
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
  /** Position among identical rows of one fetch; 0 (default) is the first. */
  readonly ordinal?: number;
}

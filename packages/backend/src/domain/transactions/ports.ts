import type {
  BankAccountId,
  TransactionId,
  TransferId,
  PlannedItemId,
  UserId,
  HouseholdId,
} from '@power-budget/core';
import type {
  Transaction,
  NewTransaction,
  NewManualTransaction,
  TransactionMapping,
  Transfer,
  TransactionQuery,
  Page,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface TransactionRepository {
  /** Bank sync: the household comes from the synced connection (`input.householdId`). */
  upsertByExternalId(input: NewTransaction): Promise<{ id: TransactionId; created: boolean }>;
  insertManual(input: NewManualTransaction): Promise<Transaction>;
  accountBelongsTo(accountId: BankAccountId, scope: HouseholdScope): Promise<boolean>;
  findById(id: TransactionId, scope: HouseholdScope): Promise<Transaction | null>;
  list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<Transaction>>;
  patch(
    id: TransactionId,
    patch: Partial<Pick<Transaction, 'notes' | 'ignored' | 'suggestedPlannedItemId'>>,
    scope: HouseholdScope,
  ): Promise<void>;
}

export interface MappingRepository {
  /**
   * Throws TransactionNotFoundError / PlannedItemNotFoundError when the transaction or the
   * planned item is not in `scope`.
   */
  set(
    transactionId: TransactionId,
    plannedItemId: PlannedItemId | null,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void>;
  /** All-or-nothing: validates every id against `scope` before writing anything. */
  bulkSet(
    input: { transactionId: TransactionId; plannedItemId: PlannedItemId }[],
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void>;
  findByTransaction(id: TransactionId, scope: HouseholdScope): Promise<TransactionMapping | null>;
}

export interface TransferRepository {
  /** Throws TransactionNotFoundError when either transaction is not in `scope`. */
  mark(
    transactionId: TransactionId,
    counterpart: TransactionId | null,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<TransferId>;
  unmark(transactionId: TransactionId, scope: HouseholdScope): Promise<void>;
  findByTransaction(id: TransactionId, scope: HouseholdScope): Promise<Transfer | null>;
}

export interface MappingSuggestionPort {
  suggest(tx: Transaction, recentMappings: TransactionMapping[]): PlannedItemId | null;
}

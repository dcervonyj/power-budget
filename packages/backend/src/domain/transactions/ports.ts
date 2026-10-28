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
  OwnedAccountRef,
  TransactionListItem,
  TransactionMapping,
  Transfer,
  TransactionQuery,
  TransactionPatch,
  TransactionUpgrade,
  ProvisionalQuery,
  Page,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface TransactionRepository {
  /**
   * Bank sync: one `INSERT ... ON CONFLICT DO NOTHING` per batch (the household comes from each
   * row's `householdId`). Rows whose (account, external id) is already stored, or repeated in
   * the batch, are skipped; returns how many rows were created.
   */
  insertBankBatch(inputs: readonly NewTransaction[]): Promise<number>;
  insertManual(input: NewManualTransaction): Promise<Transaction>;
  /** The account when it is in `scope` and owned by `ownerUserId` (accounts are private). */
  findOwnedAccount(
    accountId: BankAccountId,
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<OwnedAccountRef | null>;
  findById(id: TransactionId, scope: HouseholdScope): Promise<Transaction | null>;
  /** The transaction when it is in `scope` and on an account owned by `ownerUserId`. */
  findOwnedById(
    id: TransactionId,
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<Transaction | null>;
  /** The subset of `ids` that are in `scope` and on accounts owned by `ownerUserId`. */
  findOwnedIds(
    ids: readonly TransactionId[],
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<TransactionId[]>;
  /** One query: each row carries its mapping (with plan and category names) and transfer. */
  list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<TransactionListItem>>;
  /**
   * Changes only the given fields. Throws PlannedItemNotFoundError / CategoryNotFoundError
   * when a suggested planned item or category is not in `scope`.
   */
  patch(id: TransactionId, patch: TransactionPatch, scope: HouseholdScope): Promise<void>;
  /**
   * Upgrades a provisional row in place (plan-banking.md §1.7): status, external id, date,
   * amount, description and bank fields change; id, mapping, transfer link, suggestion and
   * notes stay; the previous state is appended to `reconciliation`. Returns null when the row
   * is not in `scope`, not on `upgrade.accountId`, or not provisional (`live` may become
   * `pending` or `booked`, `pending` only `booked`).
   */
  upgradeInPlace(upgrade: TransactionUpgrade, scope: HouseholdScope): Promise<Transaction | null>;
  /** The `live` and `pending` rows of an account in a date window, oldest first. */
  listProvisional(query: ProvisionalQuery, scope: HouseholdScope): Promise<Transaction[]>;
  /** One statement for the batch: sets `ignored` on every id in `scope`. */
  setIgnored(ids: readonly TransactionId[], ignored: boolean, scope: HouseholdScope): Promise<void>;
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
  /**
   * All-or-nothing, in one database transaction: marks each id as a standalone transfer.
   * Throws TransactionNotFoundError when an id is not in `scope` and AlreadyMappedError when
   * one is mapped to a planned item; ids that already are a transfer (either side) stay as
   * they are.
   */
  bulkMarkStandalone(
    ids: readonly TransactionId[],
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void>;
  unmark(transactionId: TransactionId, scope: HouseholdScope): Promise<void>;
  findByTransaction(id: TransactionId, scope: HouseholdScope): Promise<Transfer | null>;
}

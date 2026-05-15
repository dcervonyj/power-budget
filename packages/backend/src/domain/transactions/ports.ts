import type {
  TransactionId,
  TransferId,
  PlannedItemId,
  UserId,
  HouseholdId,
  PlanId,
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
  upsertByExternalId(input: NewTransaction): Promise<{ id: TransactionId; created: boolean }>;
  insertManual(input: NewManualTransaction): Promise<Transaction>;
  findById(id: TransactionId, scope: HouseholdScope): Promise<Transaction | null>;
  list(query: TransactionQuery, scope: HouseholdScope): Promise<Page<Transaction>>;
  patch(
    id: TransactionId,
    patch: Partial<Pick<Transaction, 'notes' | 'ignored' | 'suggestedPlannedItemId'>>,
  ): Promise<void>;
}

export interface MappingRepository {
  set(transactionId: TransactionId, plannedItemId: PlannedItemId | null, by: UserId): Promise<void>;
  bulkSet(
    input: { transactionId: TransactionId; plannedItemId: PlannedItemId }[],
    by: UserId,
  ): Promise<void>;
  findByTransaction(id: TransactionId): Promise<TransactionMapping | null>;
}

export interface TransferRepository {
  mark(
    transactionId: TransactionId,
    counterpart: TransactionId | null,
    by: UserId,
  ): Promise<TransferId>;
  unmark(transactionId: TransactionId): Promise<void>;
  findByTransaction(id: TransactionId): Promise<Transfer | null>;
}

export interface MappingSuggestionPort {
  suggest(tx: Transaction, recentMappings: TransactionMapping[]): PlannedItemId | null;
}

export interface PlanActualsRefreshPort {
  scheduleRefresh(planId: PlanId): Promise<void>;
}

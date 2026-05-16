import type {
  TransactionId,
  PlannedItemId,
  UserId,
  HouseholdId,
  PlanId,
  BankAccountId,
} from '@power-budget/core';
import type { Transaction, TransactionMapping, TransactionQuery, Transfer } from '../../domain/entities.js';

export interface AddManualTransactionInput {
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly occurredOn: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly merchant: string | null;
  readonly notes: string | null;
}

export interface BulkMapTransactionsInput {
  readonly mappings: ReadonlyArray<{ transactionId: TransactionId; plannedItemId: PlannedItemId }>;
  readonly by: UserId;
  readonly planId: PlanId;
}

export interface TransactionDetail {
  readonly transaction: Transaction;
  readonly mapping: TransactionMapping | null;
  readonly transfer: Transfer | null;
}

export interface RawTransaction {
  readonly externalId: string | null;
  readonly occurredOn: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly merchant: string | null;
}

export interface IngestBankTransactionsInput {
  readonly accountId: BankAccountId;
  readonly rawTransactions: readonly RawTransaction[];
  readonly householdId: HouseholdId;
}

export interface ListTransactionsInput {
  readonly query: TransactionQuery;
  readonly householdId: HouseholdId;
}

export interface MapTransactionInput {
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId | null;
  readonly by: UserId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
}

export interface MarkAsTransferInput {
  readonly transactionId: TransactionId;
  readonly counterpartId: TransactionId | null;
  readonly by: UserId;
  readonly householdId: HouseholdId;
}

export interface PatchTransactionInput {
  readonly transactionId: TransactionId;
  readonly householdId: HouseholdId;
  readonly patch: Partial<Pick<Transaction, 'notes' | 'ignored'>>;
}

export interface UnmarkTransferInput {
  readonly transactionId: TransactionId;
  readonly householdId: HouseholdId;
}

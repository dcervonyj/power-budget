import type {
  TransactionId,
  TransactionMappingId,
  TransferId,
  BankAccountId,
  HouseholdId,
  UserId,
  PlannedItemId,
  Money,
  IsoDate,
  IsoDateTime,
} from '@power-budget/core';

export type TransactionSource = 'bank_sync' | 'manual';
export type TransactionStatus = 'pending' | 'posted' | 'cancelled';
export type TransferStatus = 'active' | 'reversed';

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

export interface TransactionQuery {
  readonly householdId: HouseholdId;
  readonly accountId?: BankAccountId;
  readonly dateFrom?: IsoDate;
  readonly dateTo?: IsoDate;
  readonly search?: string;
  readonly unmappedOnly?: boolean;
  readonly cursor?: TransactionId;
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

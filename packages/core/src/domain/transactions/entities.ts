import type { TransactionId, TransactionMappingId, TransferId } from './ids.js';
import type { TransactionSource } from './enums.js';
import type { BankAccountId } from '../bank/ids.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { PlannedItemId } from '../plans/ids.js';
import type { Money } from '../shared/money.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

export type TransactionStatus = 'pending' | 'posted' | 'cancelled';

export interface Transaction {
  readonly id: TransactionId;
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly externalId: string | null;
  readonly source: TransactionSource;
  readonly status: TransactionStatus;
  readonly amount: Money;
  readonly description: string;
  readonly merchantName: string | null;
  readonly bookedAt: IsoDate;
  readonly createdAt: IsoDateTime;
  readonly ignored?: boolean;
}

export interface Mapping {
  readonly id: TransactionMappingId;
  readonly householdId: HouseholdId;
  readonly transactionId: TransactionId;
  readonly plannedItemId: PlannedItemId;
  readonly createdByUserId: UserId;
  readonly createdAt: IsoDateTime;
}

export type TransferStatus = 'active' | 'reversed';

export interface Transfer {
  readonly id: TransferId;
  readonly householdId: HouseholdId;
  readonly fromTransactionId: TransactionId;
  readonly toTransactionId: TransactionId;
  readonly status: TransferStatus;
  readonly createdAt: IsoDateTime;
}

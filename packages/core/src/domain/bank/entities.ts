import type { BankConnectionId, BankAccountId, SyncRunId } from './ids.js';
import type { BankProvider, ConsentLifecycle } from './enums.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { Money } from '../shared/money.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

export type BankConnectionStatus = 'active' | 'expired' | 'error' | 'disconnected';

export interface BankConnection {
  readonly id: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly provider: BankProvider;
  readonly externalConnectionId: string;
  readonly status: BankConnectionStatus;
  readonly consentLifecycle: ConsentLifecycle;
  readonly consentExpiresAt: IsoDate | null;
  readonly lastSyncedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
}

export type BankAccountKind = 'checking' | 'savings' | 'credit' | 'investment' | 'other';

export interface BankAccount {
  readonly id: BankAccountId;
  readonly householdId: HouseholdId;
  readonly connectionId: BankConnectionId;
  readonly externalAccountId: string;
  readonly name: string;
  readonly currency: CurrencyCode;
  readonly kind: BankAccountKind;
  readonly balance: Money;
  readonly isActive: boolean;
  readonly createdAt: IsoDateTime;
}

export type SyncRunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface SyncRun {
  readonly id: SyncRunId;
  readonly connectionId: BankConnectionId;
  readonly status: SyncRunStatus;
  readonly transactionsIngested: number;
  readonly errorMessage: string | null;
  readonly startedAt: IsoDateTime;
  readonly finishedAt: IsoDateTime | null;
}

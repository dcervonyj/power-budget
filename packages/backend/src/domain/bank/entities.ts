import type {
  BankConnectionId,
  BankAccountId,
  HouseholdId,
  UserId,
  SyncRunId,
  EncryptedString,
  BankProvider,
  CurrencyCode,
  Money,
} from '@power-budget/core';

export type {
  BankConnectionId,
  BankAccountId,
  HouseholdId,
  UserId,
  SyncRunId,
  EncryptedString,
  BankProvider,
};

export type BankConnectionStatus = 'active' | 'expired' | 'disconnected' | 'reconnect_required';
export type CountryCode = string; // ISO 3166-1 alpha-2
export type BankId = string;

export interface BankCatalogEntry {
  readonly bankId: BankId;
  readonly name: string;
  readonly countryCode: CountryCode;
  readonly logoUrl: string | null;
}

export interface BankConnection {
  readonly id: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly provider: BankProvider;
  readonly bankId: BankId;
  readonly externalConsentRef: string | null;
  readonly encryptedConsent: EncryptedString | null;
  readonly expiresAt: Date | null;
  readonly status: BankConnectionStatus;
  readonly disconnectedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewBankConnection {
  readonly id: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly provider: BankProvider;
  readonly bankId: BankId;
  readonly externalConsentRef: string;
}

export interface BankAccount {
  readonly id: BankAccountId;
  readonly householdId: HouseholdId;
  readonly connectionId: BankConnectionId;
  readonly externalId: string;
  readonly name: string;
  readonly iban: string | null;
  readonly currency: string;
  readonly balanceMinor: bigint;
  readonly lastSyncedAt: Date | null;
  readonly createdAt: Date;
}

/** `bank`: synced from a connection; `manual`: a cash wallet the user keeps by hand. */
export type AccountKind = 'bank' | 'manual';

interface AccountBase {
  readonly id: BankAccountId;
  readonly householdId: HouseholdId;
  /** Accounts are private to their owner (PRODUCT §4.9). */
  readonly ownerUserId: UserId;
  readonly name: string;
  readonly currency: CurrencyCode;
  readonly createdAt: Date;
}

export interface ConnectedAccount extends AccountBase {
  readonly kind: 'bank';
  readonly connectionId: BankConnectionId;
  readonly balance: Money;
  readonly lastSyncedAt: Date | null;
}

export interface ManualAccount extends AccountBase {
  readonly kind: 'manual';
}

/** An account as `GET /accounts` lists it. */
export type Account = ConnectedAccount | ManualAccount;

export interface NewManualAccount {
  readonly id: BankAccountId;
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId;
  readonly name: string;
  readonly currency: CurrencyCode;
}

export interface RawBankAccount {
  readonly externalId: string;
  readonly name: string;
  readonly iban: string | null;
  readonly currency: string;
  readonly balanceMinor: bigint;
}

export interface RawTransaction {
  readonly externalId: string | null;
  readonly accountExternalId: string;
  readonly occurredOn: string; // ISO date YYYY-MM-DD
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly merchant: string | null;
}

export interface SyncRun {
  readonly id: SyncRunId;
  readonly connectionId: BankConnectionId;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly ok: boolean | null;
  readonly fetched: number | null;
  readonly error: string | null;
}

/** Reminder schedule per ARCHITECTURE.md §5.2 + PRD §4.10 */
export type ConsentReminderKind = 'seven_days' | 'one_day' | 'expired';

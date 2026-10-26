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
  IsoDate,
  BankTxStatus,
  BankTxDirection,
  BankConsentStatus,
} from '@power-budget/core';

export type {
  BankConnectionId,
  BankAccountId,
  HouseholdId,
  UserId,
  SyncRunId,
  EncryptedString,
  BankProvider,
  BankTxStatus,
  BankTxDirection,
  BankConsentStatus,
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

/**
 * An amount exactly as the bank reports it. The currency is not narrowed to `CurrencyCode`
 * because a bank may report any ISO 4217 code (an FX card payment in THB, say).
 */
export interface RawAmount {
  /** Signed minor units: negative for money out. */
  readonly amountMinor: bigint;
  readonly currency: string;
}

/**
 * One transaction as the bank reports it (BankConnector v2, plan-banking.md §1.10).
 * `amountMinor` is signed (negative for a debit) and agrees with `direction`.
 */
export interface RawTransaction {
  readonly accountExternalId: string;
  readonly status: BankTxStatus;
  /** Stable key for booked rows only; never set it from a provider's per-fetch transaction id. */
  readonly entryReference: string | null;
  readonly bookingDate: IsoDate | null;
  readonly valueDate: IsoDate | null;
  readonly transactionDate: IsoDate | null;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly direction: BankTxDirection;
  /** The instructed amount of an FX payment (Enable Banking `exchange_rate.instructed_amount`). */
  readonly originalAmount: RawAmount | null;
  readonly counterpartyName: string | null;
  readonly counterpartyIban: string | null;
  /** Remittance information (the bank's description); empty when the bank sends none. */
  readonly remittance: string;
  readonly mcc: string | null;
  readonly bankTxCode: string | null;
  readonly balanceAfter: RawAmount | null;
}

/** One balance of an account as the bank reports it. */
export interface RawBalance {
  readonly accountExternalId: string;
  readonly amount: RawAmount;
  /** The provider's balance type code as sent (ISO 20022 such as `CLBD`, `ITAV`, `XPCD`). */
  readonly balanceType: string;
  readonly referenceDate: IsoDate | null;
}

/** The account a fetch is for, by the provider's account id. */
export interface BankAccountRef {
  readonly externalId: string;
}

/**
 * The present user's request context, sent to the bank as PSU headers so an attended fetch
 * does not use the unattended quota (PSD2). Never persisted beyond a job payload.
 * More headers join when an ASPSP's `required_psu_headers` asks for them (SPK-001).
 */
export interface PsuContext {
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly acceptLanguage: string;
}

/** `default`: from `dateFrom`; `longest`: as far back as the bank allows (initial import). */
export type BankFetchStrategy = 'default' | 'longest';

export interface BankConsentStatusReport {
  readonly status: BankConsentStatus;
  /** When the consent ends; null when the provider does not say (a Wise token never expires). */
  readonly validUntil: Date | null;
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

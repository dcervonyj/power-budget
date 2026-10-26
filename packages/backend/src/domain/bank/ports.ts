import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  Account,
  BankAccount,
  BankConnection,
  ManualAccount,
  NewManualAccount,
  BankCatalogEntry,
  BankProvider,
  CountryCode,
  BankId,
  EncryptedString,
  RawBankAccount,
  RawTransaction,
  RawBalance,
  BankAccountRef,
  BankFetchStrategy,
  BankConsentStatusReport,
  PsuContext,
  NewBankConnection,
  SyncRunId,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

/** The most important seam in the codebase. v2 per plan-banking.md §1.10. */
export interface BankConnector {
  readonly provider: BankProvider;
  listSupportedBanks(country: CountryCode): Promise<BankCatalogEntry[]>;
  initiateConsent(input: {
    userId: UserId;
    bankId: BankId;
    redirectUri: string;
    historyDays: number;
  }): Promise<{ consentUrl: string; externalConsentRef: string }>;
  completeConsent(input: {
    externalConsentRef: string;
    callbackPayload: Record<string, string>;
  }): Promise<{ consentToken: EncryptedString; expiresAt: Date | null }>;
  listAccounts(connectionId: BankConnectionId, consent: EncryptedString): Promise<RawBankAccount[]>;
  /**
   * Booked, pending and cancelled transactions of one account. `psu` is the present user's
   * context for an attended fetch, null for an unattended one. Failures are the typed
   * `BankConnectorError` subclasses (errors.ts).
   */
  fetchTransactions(input: FetchTransactionsInput): Promise<RawTransaction[]>;
  fetchBalances(input: FetchBalancesInput): Promise<RawBalance[]>;
  getConsentStatus(consent: EncryptedString): Promise<BankConsentStatusReport>;
  refreshConsent(connectionId: BankConnectionId): Promise<{ consentUrl: string }>;
  disconnect(connectionId: BankConnectionId, consent: EncryptedString): Promise<void>;
}

export interface FetchTransactionsInput {
  readonly account: BankAccountRef;
  readonly consent: EncryptedString;
  readonly dateFrom: Date;
  readonly strategy: BankFetchStrategy;
  readonly psu: PsuContext | null;
}

export interface FetchBalancesInput {
  readonly account: BankAccountRef;
  readonly consent: EncryptedString;
  readonly psu: PsuContext | null;
}

/**
 * The bank catalogue of a country, kept for a while so that listing banks does not spend
 * the provider's quota on every request (CLN-033, audit BE-BUGS-17).
 */
export interface BankCatalogCache {
  /** The entries stored for `country`, or null when there are none or they expired. */
  get(country: CountryCode): Promise<BankCatalogEntry[] | null>;
  set(
    country: CountryCode,
    entries: readonly BankCatalogEntry[],
    ttlSeconds: number,
  ): Promise<void>;
}

export interface BankConnectionRepository {
  /** Stores a new connection as `pending`: it waits for the consent callback (CLN-038). */
  create(conn: NewBankConnection): Promise<BankConnection>;
  findById(id: BankConnectionId, scope: HouseholdScope): Promise<BankConnection | null>;
  /** The user's `active` connection to the bank that holds a consent; `pending` ones never match. */
  findActiveByUserAndBank(
    userId: UserId,
    bankId: BankId,
    provider: BankProvider,
  ): Promise<BankConnection | null>;
  listByUser(userId: UserId): Promise<BankConnection[]>;
  /** Every `active` connection that holds a consent: what the scheduler syncs. */
  findActiveConnections(): Promise<BankConnection[]>;
  updateConsent(
    id: BankConnectionId,
    consent: EncryptedString,
    expiresAt: Date | null,
    scope: HouseholdScope,
  ): Promise<void>;
  markActive(id: BankConnectionId, scope: HouseholdScope): Promise<void>;
  /** Marks the connection `disconnected` and drops the stored consent, so nothing can sync it. */
  markDisconnected(id: BankConnectionId, at: Date, scope: HouseholdScope): Promise<void>;
}

export interface BankAccountRepository {
  /** Accounts synced from a connection belong to the connection's user (`ownerUserId`). */
  upsertAll(
    accounts: RawBankAccount[],
    connectionId: BankConnectionId,
    ownerUserId: UserId,
    scope: HouseholdScope,
  ): Promise<void>;
  listByConnection(connectionId: BankConnectionId, scope: HouseholdScope): Promise<BankAccount[]>;
}

/** Every account kind (bank and manual), owner-filtered: accounts are private. */
export interface AccountRepository {
  listOwned(ownerUserId: UserId, scope: HouseholdScope): Promise<Account[]>;
  createManual(input: NewManualAccount, scope: HouseholdScope): Promise<ManualAccount>;
}

export interface SyncRunStartOptions {
  readonly trigger: 'scheduled' | 'manual' | 'live_signal' | 'reserve';
  readonly attended: boolean;
}

export interface SyncRunRepository {
  start(connectionId: BankConnectionId, options: SyncRunStartOptions): Promise<SyncRunId>;
  finish(id: SyncRunId, result: { ok: boolean; fetched: number; error?: string }): Promise<void>;
  lastSuccessfulAt(connectionId: BankConnectionId): Promise<Date | null>;
}

/** Registry that resolves a BankConnector by provider. */
export interface BankConnectorRegistry {
  resolve(provider: BankProvider): BankConnector;
  listProviders(): BankProvider[];
}

export interface BankSyncQueuePort {
  /**
   * Enqueue one sync of a connection. Repeats do not stack: while a sync of the
   * connection is waiting or running, further enqueues are dropped. `scheduledAt`
   * (the cron slot) makes the job id deterministic, so the same slot is enqueued once.
   */
  enqueue(payload: {
    connectionId: BankConnectionId;
    householdId: HouseholdId;
    /** Recorded on the sync run; scheduled syncs are unattended, manual ones are user-initiated. */
    trigger: SyncRunStartOptions['trigger'];
    attended: boolean;
    since?: Date;
    scheduledAt?: Date;
  }): Promise<{ jobId: string }>;
}

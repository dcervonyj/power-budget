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
  NewBankConnection,
  SyncRunId,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

/** The most important seam in the codebase. Per ARCHITECTURE.md §5.2. */
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
  fetchTransactions(input: {
    accountExternalId: string;
    consent: EncryptedString;
    since: Date;
  }): Promise<RawTransaction[]>;
  refreshConsent(connectionId: BankConnectionId): Promise<{ consentUrl: string }>;
  disconnect(connectionId: BankConnectionId, consent: EncryptedString): Promise<void>;
}

export interface BankConnectionRepository {
  create(conn: NewBankConnection): Promise<BankConnection>;
  findById(id: BankConnectionId, scope: HouseholdScope): Promise<BankConnection | null>;
  findActiveByUserAndBank(
    userId: UserId,
    bankId: BankId,
    provider: BankProvider,
  ): Promise<BankConnection | null>;
  listByUser(userId: UserId): Promise<BankConnection[]>;
  findActiveConnections(): Promise<BankConnection[]>;
  updateConsent(
    id: BankConnectionId,
    consent: EncryptedString,
    expiresAt: Date | null,
    scope: HouseholdScope,
  ): Promise<void>;
  markActive(id: BankConnectionId, scope: HouseholdScope): Promise<void>;
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

export interface SyncRunRepository {
  start(connectionId: BankConnectionId): Promise<SyncRunId>;
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
    since?: Date;
    scheduledAt?: Date;
  }): Promise<{ jobId: string }>;
}

import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  BankAccount,
  BankConnection,
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
  findByExternalConsentRef(ref: string): Promise<BankConnection | null>;
  findActiveByUserAndBank(
    userId: UserId,
    bankId: BankId,
    provider: BankProvider,
  ): Promise<BankConnection | null>;
  listByUser(userId: UserId): Promise<BankConnection[]>;
  updateConsent(
    id: BankConnectionId,
    consent: EncryptedString,
    expiresAt: Date | null,
  ): Promise<void>;
  markActive(id: BankConnectionId): Promise<void>;
  markDisconnected(id: BankConnectionId, at: Date): Promise<void>;
}

export interface BankAccountRepository {
  upsertAll(
    accounts: RawBankAccount[],
    connectionId: BankConnectionId,
    scope: HouseholdScope,
  ): Promise<void>;
  listByConnection(connectionId: BankConnectionId, scope: HouseholdScope): Promise<BankAccount[]>;
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

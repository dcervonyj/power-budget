import type {
  BankProvider,
  BankCatalogEntry,
  CountryCode,
  RawBankAccount,
  RawTransaction,
  BankId,
} from '../domain/entities.js';
import type { BankConnector } from '../domain/ports.js';
import type { BankConnectionId, EncryptedString } from '@power-budget/core';

export class InMemoryBankConnector implements BankConnector {
  readonly provider: BankProvider = 'gocardless';

  private readonly catalog: BankCatalogEntry[] = [
    { bankId: 'PKO_PLPKOPPLPW', name: 'PKO BP', countryCode: 'PL', logoUrl: null },
    { bankId: 'MBANK_BREXPLPW', name: 'mBank', countryCode: 'PL', logoUrl: null },
  ];

  async listSupportedBanks(country: CountryCode): Promise<BankCatalogEntry[]> {
    return this.catalog.filter((e) => e.countryCode === country);
  }

  async initiateConsent(input: {
    userId: string;
    bankId: BankId;
    redirectUri: string;
    historyDays: number;
  }): Promise<{ consentUrl: string; externalConsentRef: string }> {
    const ref = `inmem-ref-${input.bankId}-${Date.now()}`;

    return {
      consentUrl: `https://mock.gocardless.test/consent?ref=${ref}&redirect=${encodeURIComponent(input.redirectUri)}`,
      externalConsentRef: ref,
    };
  }

  async completeConsent(input: {
    externalConsentRef: string;
    callbackPayload: Record<string, string>;
  }): Promise<{ consentToken: EncryptedString; expiresAt: Date | null }> {
    return {
      consentToken: `inmem-token:${input.externalConsentRef}` as EncryptedString,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
  }

  async listAccounts(): Promise<RawBankAccount[]> {
    return [];
  }

  async fetchTransactions(): Promise<RawTransaction[]> {
    return [];
  }

  async refreshConsent(connectionId: BankConnectionId): Promise<{ consentUrl: string }> {
    return { consentUrl: `https://mock.gocardless.test/consent?reconnect=${connectionId}` };
  }

  async disconnect(): Promise<void> {
    // no-op in memory
  }
}

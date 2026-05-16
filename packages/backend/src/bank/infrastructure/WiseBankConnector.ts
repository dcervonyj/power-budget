import type { BankConnectionId, EncryptedString } from '@power-budget/core';
import type { BankConnector } from '../domain/ports.js';
import type {
  BankProvider,
  BankCatalogEntry,
  CountryCode,
  RawBankAccount,
  RawTransaction,
} from '../domain/entities.js';
import type { Encryption } from '../../auth/domain/ports.js';

interface WiseProfile {
  readonly id: number;
  readonly type: 'personal' | 'business';
}

interface WiseBorderlessBalance {
  readonly currency: string;
  readonly amount: { readonly value: number; readonly currency: string };
  readonly bankDetails?: { readonly iban?: string | null } | null;
}

interface WiseBorderlessAccount {
  readonly id: number;
  readonly balances: WiseBorderlessBalance[];
}

interface WiseStatementTransaction {
  readonly type: string;
  readonly date: string;
  readonly amount: { readonly value: number; readonly currency: string };
  readonly details: { readonly description?: string; readonly paymentReference?: string };
  readonly referenceNumber: string;
}

interface WiseStatement {
  readonly transactions: WiseStatementTransaction[];
}

export class WiseBankConnector implements BankConnector {
  readonly provider: BankProvider = 'wise_personal';

  constructor(
    private readonly encryption: Encryption,
    private readonly baseUrl = 'https://api.wise.com',
  ) {}

  private async apiRequest<T>(apiToken: string, path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await globalThis.fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Wise API error: ${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as Promise<T>;
  }

  async listSupportedBanks(country: CountryCode): Promise<BankCatalogEntry[]> {
    return [
      {
        bankId: 'wise',
        name: 'Wise',
        countryCode: country,
        logoUrl: 'https://wise.com/favicon.ico',
      },
    ];
  }

  async initiateConsent(): Promise<{ consentUrl: string; externalConsentRef: string }> {
    return {
      consentUrl: 'wise-connect://token-entry',
      externalConsentRef: 'wise-pending',
    };
  }

  async completeConsent(input: {
    externalConsentRef: string;
    callbackPayload: Record<string, string>;
  }): Promise<{ consentToken: EncryptedString; expiresAt: Date | null }> {
    const apiToken = input.callbackPayload['apiToken'];
    if (!apiToken) {
      throw new Error('Wise completeConsent: missing apiToken in callbackPayload');
    }

    const consentToken = await this.encryption.encrypt(apiToken);

    return { consentToken, expiresAt: null };
  }

  async listAccounts(
    _connectionId: BankConnectionId,
    consent: EncryptedString,
  ): Promise<RawBankAccount[]> {
    const apiToken = await this.encryption.decrypt(consent);
    const profiles = await this.apiRequest<WiseProfile[]>(apiToken, '/v1/profiles');
    const personal = profiles.find((p) => p.type === 'personal');

    if (!personal) {
      return [];
    }

    const accounts = await this.apiRequest<WiseBorderlessAccount[]>(
      apiToken,
      `/v2/borderless-accounts?profileId=${personal.id}`,
    );

    const result: RawBankAccount[] = [];

    for (const account of accounts) {
      for (const balance of account.balances) {
        result.push({
          externalId: `${account.id}-${balance.currency}`,
          name: `Wise ${balance.currency}`,
          iban: balance.bankDetails?.iban ?? null,
          currency: balance.currency,
          balanceMinor: BigInt(Math.round(balance.amount.value * 100)),
        });
      }
    }

    return result;
  }

  async fetchTransactions(input: {
    accountExternalId: string;
    consent: EncryptedString;
    since: Date;
  }): Promise<RawTransaction[]> {
    const apiToken = await this.encryption.decrypt(input.consent);
    const profiles = await this.apiRequest<WiseProfile[]>(apiToken, '/v1/profiles');
    const personal = profiles.find((p) => p.type === 'personal');

    if (!personal) {
      return [];
    }

    // externalId format is "{accountId}-{currency}"; split at last hyphen
    const dashIdx = input.accountExternalId.lastIndexOf('-');
    const accountId = input.accountExternalId.substring(0, dashIdx);
    const currency = input.accountExternalId.substring(dashIdx + 1);

    const intervalStart = input.since.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const intervalEnd = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const path =
      `/v3/profiles/${personal.id}/borderless-accounts/${accountId}/statement.json` +
      `?currency=${currency}&intervalStart=${intervalStart}&intervalEnd=${intervalEnd}`;

    const statement = await this.apiRequest<WiseStatement>(apiToken, path);

    return statement.transactions.map((tx) => ({
      externalId: tx.referenceNumber,
      accountExternalId: input.accountExternalId,
      occurredOn: tx.date.substring(0, 10),
      amountMinor: BigInt(Math.round(tx.amount.value * 100)),
      currency: tx.amount.currency,
      description: tx.details.description || tx.details.paymentReference || '',
      merchant: null,
    }));
  }

  async refreshConsent(): Promise<{ consentUrl: string }> {
    // Wise personal API tokens do not expire; prompt the user to re-enter a new token
    throw new Error(
      'Wise tokens do not expire. To reconnect, provide a new API token via wise-connect://token-entry.',
    );
  }

  async disconnect(): Promise<void> {
    // Wise Personal API does not support token revocation via API
  }
}

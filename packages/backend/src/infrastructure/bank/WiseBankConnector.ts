import { randomUUID } from 'node:crypto';
import type { BankConnectionId, EncryptedString } from '@power-budget/core';
import { IsoDate, bankTxDirectionOf, parseMoney } from '@power-budget/core';
import type {
  BankConnector,
  FetchBalancesInput,
  FetchTransactionsInput,
} from '../../domain/bank/ports.js';
import type {
  BankProvider,
  BankCatalogEntry,
  BankConsentStatusReport,
  CountryCode,
  RawBalance,
  RawBankAccount,
  RawTransaction,
} from '../../domain/bank/entities.js';
import type { Encryption } from '../../domain/auth/ports.js';

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
    // A unique ref per connection (audit C4): a shared constant let one user's
    // token be written onto another user's connection.
    return {
      consentUrl: 'wise-connect://token-entry',
      externalConsentRef: `wise-${randomUUID()}`,
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
          balanceMinor: this.toMinor(balance.amount),
        });
      }
    }

    return result;
  }

  /** Statement rows are completed, so all are booked. Wise has no PSU headers. */
  async fetchTransactions(input: FetchTransactionsInput): Promise<RawTransaction[]> {
    const apiToken = await this.encryption.decrypt(input.consent);
    const profiles = await this.apiRequest<WiseProfile[]>(apiToken, '/v1/profiles');
    const personal = profiles.find((p) => p.type === 'personal');

    if (!personal) {
      return [];
    }

    const { accountId, currency } = this.splitExternalId(input.account.externalId);

    const intervalStart = input.dateFrom.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const intervalEnd = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const path =
      `/v3/profiles/${personal.id}/borderless-accounts/${accountId}/statement.json` +
      `?currency=${currency}&intervalStart=${intervalStart}&intervalEnd=${intervalEnd}`;

    const statement = await this.apiRequest<WiseStatement>(apiToken, path);

    return statement.transactions.map((tx) => this.toRawTransaction(tx, input.account.externalId));
  }

  async fetchBalances(input: FetchBalancesInput): Promise<RawBalance[]> {
    const apiToken = await this.encryption.decrypt(input.consent);
    const profiles = await this.apiRequest<WiseProfile[]>(apiToken, '/v1/profiles');
    const personal = profiles.find((p) => p.type === 'personal');

    if (!personal) {
      return [];
    }

    const { accountId, currency } = this.splitExternalId(input.account.externalId);
    const accounts = await this.apiRequest<WiseBorderlessAccount[]>(
      apiToken,
      `/v2/borderless-accounts?profileId=${personal.id}`,
    );
    const balance = accounts
      .find((account) => String(account.id) === accountId)
      ?.balances.find((b) => b.currency === currency);

    if (balance === undefined) {
      return [];
    }

    return [
      {
        accountExternalId: input.account.externalId,
        amount: { amountMinor: this.toMinor(balance.amount), currency: balance.amount.currency },
        // Wise reports the available amount: ISO 20022 interim available.
        balanceType: 'ITAV',
        referenceDate: null,
      },
    ];
  }

  /** A personal token never expires; a 401 or 403 means the user revoked it. */
  async getConsentStatus(consent: EncryptedString): Promise<BankConsentStatusReport> {
    const apiToken = await this.encryption.decrypt(consent);
    const response = await this.send(apiToken, '/v1/profiles');

    if (response.status === 401 || response.status === 403) {
      return { status: 'revoked', validUntil: null };
    }
    if (!response.ok) {
      throw new Error(`Wise API error: ${response.status} ${response.statusText} for /v1/profiles`);
    }

    return { status: 'active', validUntil: null };
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

  private async apiRequest<T>(apiToken: string, path: string): Promise<T> {
    const response = await this.send(apiToken, path);

    if (!response.ok) {
      throw new Error(`Wise API error: ${response.status} ${response.statusText} for ${path}`);
    }

    return response.json() as Promise<T>;
  }

  private send(apiToken: string, path: string): Promise<Response> {
    return globalThis.fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /** The external id is "{accountId}-{currency}"; split at the last hyphen. */
  private splitExternalId(externalId: string): { accountId: string; currency: string } {
    const dashIdx = externalId.lastIndexOf('-');

    return {
      accountId: externalId.substring(0, dashIdx),
      currency: externalId.substring(dashIdx + 1),
    };
  }

  private toRawTransaction(
    tx: WiseStatementTransaction,
    accountExternalId: string,
  ): RawTransaction {
    const amountMinor = this.toMinor(tx.amount);

    return {
      accountExternalId,
      status: 'booked',
      entryReference: tx.referenceNumber,
      bookingDate: IsoDate.of(tx.date.substring(0, 10)),
      valueDate: null,
      transactionDate: null,
      amountMinor,
      currency: tx.amount.currency,
      direction: bankTxDirectionOf(amountMinor),
      originalAmount: null,
      counterpartyName: null,
      counterpartyIban: null,
      remittance: tx.details.description || tx.details.paymentReference || '',
      mcc: null,
      bankTxCode: null,
      balanceAfter: null,
    };
  }

  /** Wise sends JSON numbers; parse their decimal text, never multiply a float. */
  private toMinor(amount: { readonly value: number; readonly currency: string }): bigint {
    return parseMoney(String(amount.value), amount.currency);
  }
}

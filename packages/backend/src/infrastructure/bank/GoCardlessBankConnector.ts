import type { BankConnectionId, EncryptedString, UserId } from '@power-budget/core';
import type { BankConnector } from '../../domain/bank/ports.js';
import type {
  BankProvider,
  BankCatalogEntry,
  CountryCode,
  RawBankAccount,
  RawTransaction,
  BankId,
} from '../../domain/bank/entities.js';
import type { Encryption } from '../../domain/auth/ports.js';
import { uuidv7 } from 'uuidv7';

// ── GoCardless API response shapes ───────────────────────────────────────────

interface GcTokenResponse {
  access: string;
  refresh: string;
  access_expires: number;
  refresh_expires: number;
}

interface GcInstitution {
  id: string;
  name: string;
  countries: string[];
  logo: string | null;
}

interface GcRequisition {
  id: string;
  link: string;
  status: string;
  accounts: string[];
}

interface GcAccountDetails {
  account: {
    iban?: string;
    name?: string;
    currency?: string;
  };
}

interface GcTransaction {
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  creditorName?: string;
}

interface GcTransactionsResponse {
  transactions: {
    booked: GcTransaction[];
    pending: GcTransaction[];
  };
}

interface ConsentPayload {
  requisitionId: string;
  accounts: string[];
}

// ── Connector implementation ─────────────────────────────────────────────────

export class GoCardlessBankConnector implements BankConnector {
  readonly provider: BankProvider = 'gocardless';

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly secretId: string,
    private readonly secretKey: string,
    private readonly encryption: Encryption,
    private readonly baseUrl = 'https://bankaccountdata.gocardless.com/api/v2',
  ) {}

  // ── Public interface ────────────────────────────────────────────────────────

  async listSupportedBanks(country: CountryCode): Promise<BankCatalogEntry[]> {
    const institutions = await this.request<GcInstitution[]>(
      'GET',
      `/institutions/?country=${country}`,
    );

    return institutions.map((inst) => ({
      bankId: inst.id,
      name: inst.name,
      countryCode: inst.countries[0] ?? country,
      logoUrl: inst.logo ?? null,
    }));
  }

  async initiateConsent(input: {
    userId: UserId;
    bankId: BankId;
    redirectUri: string;
    historyDays: number;
  }): Promise<{ consentUrl: string; externalConsentRef: string }> {
    const requisition = await this.request<GcRequisition>('POST', '/requisitions/', {
      institution_id: input.bankId,
      redirect: input.redirectUri,
      reference: uuidv7(),
      max_historical_days: input.historyDays,
    });

    return {
      consentUrl: requisition.link,
      externalConsentRef: requisition.id,
    };
  }

  async completeConsent(input: {
    externalConsentRef: string;
    callbackPayload: Record<string, string>;
  }): Promise<{ consentToken: EncryptedString; expiresAt: Date | null }> {
    const requisition = await this.request<GcRequisition>(
      'GET',
      `/requisitions/${input.externalConsentRef}/`,
    );

    const payload: ConsentPayload = {
      requisitionId: requisition.id,
      accounts: requisition.accounts,
    };

    const consentToken = await this.encryption.encrypt(JSON.stringify(payload));
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    return { consentToken, expiresAt };
  }

  async listAccounts(
    _connectionId: BankConnectionId,
    consent: EncryptedString,
  ): Promise<RawBankAccount[]> {
    const raw = await this.encryption.decrypt(consent);
    const payload = JSON.parse(raw) as ConsentPayload;

    const accounts = await Promise.all(
      payload.accounts.map(async (accountId) => {
        const details = await this.request<GcAccountDetails>(
          'GET',
          `/accounts/${accountId}/details/`,
        );

        return {
          externalId: accountId,
          name: details.account.name ?? accountId,
          iban: details.account.iban ?? null,
          currency: details.account.currency ?? 'PLN',
          balanceMinor: 0n,
        } satisfies RawBankAccount;
      }),
    );

    return accounts;
  }

  async fetchTransactions(input: {
    accountExternalId: string;
    consent: EncryptedString;
    since: Date;
  }): Promise<RawTransaction[]> {
    const dateFrom = input.since.toISOString().slice(0, 10);
    const data = await this.request<GcTransactionsResponse>(
      'GET',
      `/accounts/${input.accountExternalId}/transactions/?date_from=${dateFrom}`,
    );

    return data.transactions.booked.map((tx) => {
      const occurredOn = tx.bookingDate ?? tx.valueDate ?? dateFrom;
      const amountMinor = BigInt(Math.round(parseFloat(tx.transactionAmount.amount) * 100));
      const description =
        tx.remittanceInformationUnstructured ?? tx.remittanceInformationStructured ?? '';

      return {
        externalId: tx.transactionId ?? null,
        accountExternalId: input.accountExternalId,
        occurredOn,
        amountMinor,
        currency: tx.transactionAmount.currency,
        description,
        merchant: tx.creditorName ?? null,
      } satisfies RawTransaction;
    });
  }

  async refreshConsent(): Promise<{ consentUrl: string }> {
    throw new Error('Use initiateConsent to re-initiate GoCardless consent');
  }

  async disconnect(_connectionId: BankConnectionId, consent: EncryptedString): Promise<void> {
    const raw = await this.encryption.decrypt(consent);
    const payload = JSON.parse(raw) as ConsentPayload;

    await this.request<void>('DELETE', `/requisitions/${payload.requisitionId}/`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken !== null && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const res = await this.rawRequest<GcTokenResponse>('POST', '/token/new/', {
      secret_id: this.secretId,
      secret_key: this.secretKey,
    });

    this.accessToken = res.access;
    // Subtract 60 s from expiry to guard against clock skew
    this.tokenExpiresAt = Date.now() + (res.access_expires - 60) * 1000;

    return this.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();

    return this.rawRequest<T>(method, path, body, token);
  }

  private async rawRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    authToken?: string,
  ): Promise<T> {
    const MAX_RETRIES = 3;
    let lastError: Error = new Error('GoCardless request failed');

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (authToken !== undefined) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await globalThis.fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter !== null ? parseFloat(retryAfter) * 1000 : 1000;
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        lastError = new Error('GoCardless rate limited (429)');
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GoCardless API error ${response.status}: ${text}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType === null || !contentType.includes('application/json')) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    }

    throw lastError;
  }
}

import type { BankConnectionId, EncryptedString, UserId } from '@power-budget/core';
import { IsoDate, bankTxDirectionOf, parseMoney } from '@power-budget/core';
import type {
  BankConnector,
  FetchBalancesInput,
  FetchTransactionsInput,
} from '../../domain/bank/ports.js';
import type {
  BankProvider,
  BankCatalogEntry,
  BankConsentStatus,
  BankConsentStatusReport,
  CountryCode,
  RawBalance,
  RawBankAccount,
  RawTransaction,
  BankId,
} from '../../domain/bank/entities.js';
import type { Encryption } from '../../domain/auth/ports.js';
import { BankProviderDataError, BankRateLimitedError } from '../../domain/bank/errors.js';
import { parseRetryAfter } from './retry-after.js';
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

interface GcBalance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
  referenceDate?: string;
}

interface GcBalancesResponse {
  balances: GcBalance[];
}

interface ConsentPayload {
  requisitionId: string;
  accounts: string[];
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isConsentPayload(value: unknown): value is ConsentPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'requisitionId' in value &&
    typeof value.requisitionId === 'string' &&
    'accounts' in value &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isString)
  );
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
    const payload = await this.decodeConsent(consent);

    const accounts = await Promise.all(
      payload.accounts.map(async (accountId) => {
        const details = await this.request<GcAccountDetails>(
          'GET',
          `/accounts/${accountId}/details/`,
        );

        const currency = details.account.currency;
        if (currency === undefined) {
          throw new BankProviderDataError(`GoCardless account ${accountId} has no currency`);
        }

        return {
          externalId: accountId,
          name: details.account.name ?? accountId,
          iban: details.account.iban ?? null,
          currency,
          balanceMinor: 0n,
        } satisfies RawBankAccount;
      }),
    );

    return accounts;
  }

  /**
   * Booked rows only, as before the v2 port; GoCardless leaves with BNK-008. The PSU context
   * is not sent: this integration has no PSU headers.
   */
  async fetchTransactions(input: FetchTransactionsInput): Promise<RawTransaction[]> {
    const dateFrom = input.dateFrom.toISOString().slice(0, 10);
    // `longest`: without date_from GoCardless returns all the history the consent allows.
    const query = input.strategy === 'longest' ? '' : `?date_from=${dateFrom}`;
    const data = await this.request<GcTransactionsResponse>(
      'GET',
      `/accounts/${input.account.externalId}/transactions/${query}`,
    );

    return data.transactions.booked.map((tx) =>
      this.toRawTransaction(tx, input.account.externalId, dateFrom),
    );
  }

  async fetchBalances(input: FetchBalancesInput): Promise<RawBalance[]> {
    const data = await this.request<GcBalancesResponse>(
      'GET',
      `/accounts/${input.account.externalId}/balances/`,
    );

    return data.balances.map((balance) => ({
      accountExternalId: input.account.externalId,
      amount: {
        amountMinor: parseMoney(balance.balanceAmount.amount, balance.balanceAmount.currency),
        currency: balance.balanceAmount.currency,
      },
      balanceType: balance.balanceType,
      referenceDate: balance.referenceDate ? IsoDate.of(balance.referenceDate) : null,
    }));
  }

  /** GoCardless does not say when a requisition ends, so `validUntil` is null. */
  async getConsentStatus(consent: EncryptedString): Promise<BankConsentStatusReport> {
    const payload = await this.decodeConsent(consent);
    const requisition = await this.request<GcRequisition>(
      'GET',
      `/requisitions/${payload.requisitionId}/`,
    );

    return { status: this.toConsentStatus(requisition.status), validUntil: null };
  }

  async refreshConsent(): Promise<{ consentUrl: string }> {
    throw new Error('Use initiateConsent to re-initiate GoCardless consent');
  }

  async disconnect(_connectionId: BankConnectionId, consent: EncryptedString): Promise<void> {
    const payload = await this.decodeConsent(consent);

    await this.request<void>('DELETE', `/requisitions/${payload.requisitionId}/`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async decodeConsent(consent: EncryptedString): Promise<ConsentPayload> {
    const raw = await this.encryption.decrypt(consent);

    const payload: unknown = JSON.parse(raw);
    if (!isConsentPayload(payload)) {
      throw new Error('GoCardless consent payload is malformed');
    }

    return payload;
  }

  private toRawTransaction(
    tx: GcTransaction,
    accountExternalId: string,
    dateFrom: string,
  ): RawTransaction {
    const amountMinor = parseMoney(tx.transactionAmount.amount, tx.transactionAmount.currency);

    return {
      accountExternalId,
      status: 'booked',
      // GoCardless's transactionId stays the key so re-syncs of stored rows do not duplicate.
      entryReference: tx.transactionId ?? null,
      bookingDate: this.bookingDateOf(tx, dateFrom),
      valueDate: tx.valueDate ? IsoDate.of(tx.valueDate) : null,
      transactionDate: null,
      amountMinor,
      currency: tx.transactionAmount.currency,
      direction: bankTxDirectionOf(amountMinor),
      originalAmount: null,
      counterpartyName: tx.creditorName ?? null,
      counterpartyIban: null,
      remittance: tx.remittanceInformationUnstructured ?? tx.remittanceInformationStructured ?? '',
      mcc: null,
      bankTxCode: null,
      balanceAfter: null,
    };
  }

  /** A row with neither booking nor value date keeps the old fallback: the fetch start date. */
  private bookingDateOf(tx: GcTransaction, dateFrom: string): IsoDate | null {
    if (tx.bookingDate) {
      return IsoDate.of(tx.bookingDate);
    }
    if (tx.valueDate) {
      return null;
    }

    return IsoDate.of(dateFrom);
  }

  /** GoCardless requisition status codes (CR, GC, UA, SA, GA, LN, RJ, EX, SU). */
  private toConsentStatus(status: string): BankConsentStatus {
    switch (status) {
      case 'LN':
        return 'active';
      case 'EX':
        return 'expired';
      case 'RJ':
      case 'SU':
        return 'failed';
      case 'CR':
      case 'GC':
      case 'UA':
      case 'SA':
      case 'GA':
        return 'pending_authorization';
      default:
        throw new Error(`Unknown GoCardless requisition status ${status}`);
    }
  }

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

  /**
   * One attempt, never a sleep (CLN-033, audit BE-BUGS-17): a 429 throws BankRateLimitedError
   * with the provider's `Retry-After` (delta-seconds or HTTP-date), so an HTTP request answers
   * at once and a sync job backs off through its queue.
   */
  private async rawRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    authToken?: string,
  ): Promise<T> {
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
      throw new BankRateLimitedError(
        parseRetryAfter(response.headers.get('Retry-After'), new Date()),
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GoCardless API error ${response.status}: ${text}`);
    }

    if (response.status === 204) {
      // `T` is `void` for calls without a body; there is no value to build for a generic return type.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType === null || !contentType.includes('application/json')) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- no body to parse, same as the 204 case
      return undefined as T;
    }

    return response.json();
  }
}

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EncryptedString } from '@power-budget/core';
import type { Encryption } from '../../domain/auth/ports.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';
import { BankRateLimitedError } from '../../domain/bank/errors.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeEncryption(): Encryption {
  return {
    encrypt: vi.fn().mockImplementation(async (plaintext: string) => `enc:${plaintext}`),
    decrypt: vi
      .fn()
      .mockImplementation(async (ciphertext: string) =>
        ciphertext.startsWith('enc:') ? ciphertext.slice(4) : ciphertext,
      ),
  };
}

function makeTokenResponse(overrides?: Partial<Record<string, unknown>>) {
  return {
    access: 'test-access-token',
    refresh: 'test-refresh-token',
    access_expires: 86400,
    refresh_expires: 2592000,
    ...overrides,
  };
}

const CONSENT = 'enc:{"requisitionId":"req-1","accounts":["acct-1"]}' as EncryptedString;

/** Stubs fetch: the first call answers the token request, every later one `body`. */
function stubFetch(body: unknown) {
  let callCount = 0;
  const fetchMock = vi.fn().mockImplementation(() => {
    callCount++;
    const payload = callCount === 1 ? makeTokenResponse() : body;

    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

// ── Connector factory ─────────────────────────────────────────────────────────

function makeConnector(encryption?: Encryption) {
  return new GoCardlessBankConnector(
    'secret-id',
    'secret-key',
    encryption ?? makeEncryption(),
    'https://test.gocardless.test/api/v2',
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GoCardlessBankConnector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // 1. listSupportedBanks ─────────────────────────────────────────────────────
  describe('listSupportedBanks', () => {
    it('returns mapped catalog entries for the requested country', async () => {
      const institutions = [
        { id: 'PKO_PLPKOPPLPW', name: 'PKO BP', countries: ['PL'], logo: 'https://logo.png' },
        { id: 'MBANK_BREXPLPW', name: 'mBank', countries: ['PL'], logo: null },
      ];

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          // First call = token endpoint, second = institutions
          const body = callCount === 1 ? makeTokenResponse() : institutions;

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
          });
        }),
      );

      const connector = makeConnector();
      const result = await connector.listSupportedBanks('PL');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        bankId: 'PKO_PLPKOPPLPW',
        name: 'PKO BP',
        countryCode: 'PL',
        logoUrl: 'https://logo.png',
      });
      expect(result[1]).toEqual({
        bankId: 'MBANK_BREXPLPW',
        name: 'mBank',
        countryCode: 'PL',
        logoUrl: null,
      });
    });
  });

  // 2. initiateConsent ────────────────────────────────────────────────────────
  describe('initiateConsent', () => {
    it('returns consentUrl and externalConsentRef from the requisition', async () => {
      const requisition = {
        id: 'req-abc123',
        link: 'https://ob.gocardless.com/psd2/start/req-abc123',
        status: 'CR',
        accounts: [],
      };

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          const body = callCount === 1 ? makeTokenResponse() : requisition;

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
          });
        }),
      );

      const connector = makeConnector();
      const result = await connector.initiateConsent({
        userId: 'user-1' as never,
        bankId: 'PKO_PLPKOPPLPW',
        redirectUri: 'https://app.example.com/callback',
        historyDays: 90,
      });

      expect(result.consentUrl).toBe(requisition.link);
      expect(result.externalConsentRef).toBe(requisition.id);
    });
  });

  // 3. completeConsent ────────────────────────────────────────────────────────
  describe('completeConsent', () => {
    it('encrypts consent payload and returns 90-day expiry', async () => {
      const requisition = {
        id: 'req-abc123',
        link: 'https://ob.gocardless.com/psd2/start/req-abc123',
        status: 'LN',
        accounts: ['acct-1', 'acct-2'],
      };

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          const body = callCount === 1 ? makeTokenResponse() : requisition;

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
          });
        }),
      );

      const encryption = makeEncryption();
      const connector = makeConnector(encryption);
      const now = Date.now();

      const result = await connector.completeConsent({
        externalConsentRef: 'req-abc123',
        callbackPayload: {},
      });

      expect(encryption.encrypt).toHaveBeenCalledWith(
        JSON.stringify({ requisitionId: 'req-abc123', accounts: ['acct-1', 'acct-2'] }),
      );

      expect(result.consentToken).toBe(
        `enc:${JSON.stringify({ requisitionId: 'req-abc123', accounts: ['acct-1', 'acct-2'] })}`,
      );

      // expiresAt should be ~90 days from now (within 5 seconds tolerance)
      expect(result.expiresAt).not.toBeNull();
      const expiryMs = result.expiresAt!.getTime();
      const expected90Days = now + 90 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiryMs - expected90Days)).toBeLessThan(5000);
    });
  });

  // 4. fetchTransactions ──────────────────────────────────────────────────────
  describe('fetchTransactions', () => {
    it('maps GoCardless booked transactions to RawTransaction[]', async () => {
      const gcTransactions = {
        transactions: {
          booked: [
            {
              transactionId: 'tx-001',
              bookingDate: '2024-03-15',
              transactionAmount: { amount: '-42.50', currency: 'PLN' },
              remittanceInformationUnstructured: 'BIEDRONKA 1234',
              creditorName: 'Biedronka',
            },
            {
              // No transactionId → externalId should be null
              bookingDate: '2024-03-14',
              valueDate: '2024-03-13',
              transactionAmount: { amount: '1000.00', currency: 'PLN' },
              remittanceInformationStructured: 'Salary March',
            },
          ],
          pending: [],
        },
      };

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          const body = callCount === 1 ? makeTokenResponse() : gcTransactions;

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
          });
        }),
      );

      const consent = 'enc:{"requisitionId":"req-1","accounts":["acct-1"]}' as EncryptedString;
      const connector = makeConnector();
      const result = await connector.fetchTransactions({
        account: { externalId: 'acct-1' },
        consent,
        dateFrom: new Date('2024-03-01'),
        strategy: 'default',
        psu: null,
      });

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        accountExternalId: 'acct-1',
        status: 'booked',
        entryReference: 'tx-001',
        bookingDate: '2024-03-15',
        valueDate: null,
        transactionDate: null,
        amountMinor: -4250n,
        currency: 'PLN',
        direction: 'debit',
        originalAmount: null,
        counterpartyName: 'Biedronka',
        counterpartyIban: null,
        remittance: 'BIEDRONKA 1234',
        mcc: null,
        bankTxCode: null,
        balanceAfter: null,
      });

      expect(result[1]).toEqual({
        accountExternalId: 'acct-1',
        status: 'booked',
        entryReference: null,
        bookingDate: '2024-03-14',
        valueDate: '2024-03-13',
        transactionDate: null,
        amountMinor: 100000n,
        currency: 'PLN',
        direction: 'credit',
        originalAmount: null,
        counterpartyName: null,
        counterpartyIban: null,
        remittance: 'Salary March',
        mcc: null,
        bankTxCode: null,
        balanceAfter: null,
      });
    });

    it('falls back to the fetch start date when a row has no booking or value date', async () => {
      stubFetch({
        transactions: {
          booked: [{ transactionAmount: { amount: '-1.05', currency: 'PLN' } }],
          pending: [],
        },
      });

      const result = await makeConnector().fetchTransactions({
        account: { externalId: 'acct-1' },
        consent: CONSENT,
        dateFrom: new Date('2024-03-01'),
        strategy: 'default',
        psu: null,
      });

      expect(result[0]?.bookingDate).toBe('2024-03-01');
      expect(result[0]?.amountMinor).toBe(-105n);
    });

    it('asks for the whole history without date_from on the longest strategy', async () => {
      const fetchMock = stubFetch({ transactions: { booked: [], pending: [] } });

      await makeConnector().fetchTransactions({
        account: { externalId: 'acct-1' },
        consent: CONSENT,
        dateFrom: new Date('2024-03-01'),
        strategy: 'longest',
        psu: null,
      });

      expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
        'https://test.gocardless.test/api/v2/accounts/acct-1/transactions/',
      );
    });
  });

  describe('fetchBalances', () => {
    it('parses the decimal balance amounts into minor units', async () => {
      stubFetch({
        balances: [
          {
            balanceAmount: { amount: '1234.56', currency: 'PLN' },
            balanceType: 'closingBooked',
            referenceDate: '2024-03-15',
          },
          { balanceAmount: { amount: '-0.10', currency: 'PLN' }, balanceType: 'interimAvailable' },
        ],
      });

      const result = await makeConnector().fetchBalances({
        account: { externalId: 'acct-1' },
        consent: CONSENT,
        psu: null,
      });

      expect(result).toEqual([
        {
          accountExternalId: 'acct-1',
          amount: { amountMinor: 123456n, currency: 'PLN' },
          balanceType: 'closingBooked',
          referenceDate: '2024-03-15',
        },
        {
          accountExternalId: 'acct-1',
          amount: { amountMinor: -10n, currency: 'PLN' },
          balanceType: 'interimAvailable',
          referenceDate: null,
        },
      ]);
    });
  });

  describe('getConsentStatus', () => {
    it.each([
      ['LN', 'active'],
      ['EX', 'expired'],
      ['RJ', 'failed'],
      ['SU', 'failed'],
      ['GA', 'pending_authorization'],
    ])('maps requisition status %s to %s', async (gcStatus, status) => {
      const fetchMock = stubFetch({ id: 'req-1', link: '', status: gcStatus, accounts: [] });

      const result = await makeConnector().getConsentStatus(CONSENT);

      expect(result).toEqual({ status, validUntil: null });
      expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
        'https://test.gocardless.test/api/v2/requisitions/req-1/',
      );
    });

    it('throws on an unknown requisition status', async () => {
      stubFetch({ id: 'req-1', link: '', status: 'ZZ', accounts: [] });

      await expect(makeConnector().getConsentStatus(CONSENT)).rejects.toThrow(
        'Unknown GoCardless requisition status ZZ',
      );
    });
  });

  // 5. Token caching ──────────────────────────────────────────────────────────
  describe('token caching', () => {
    it('fetches a new token on first request and reuses it for subsequent calls', async () => {
      const institutions = [{ id: 'BANK_1', name: 'Bank 1', countries: ['PL'], logo: null }];

      let fetchCallCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          fetchCallCount++;

          const isTokenEndpoint = url.includes('/token/new/');
          const body = isTokenEndpoint ? makeTokenResponse() : institutions;

          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(body),
            text: () => Promise.resolve(JSON.stringify(body)),
          });
        }),
      );

      const connector = makeConnector();

      // First call → 2 fetches: token + institutions
      await connector.listSupportedBanks('PL');
      expect(fetchCallCount).toBe(2);

      // Second call → 1 fetch: institutions only (token reused)
      await connector.listSupportedBanks('PL');
      expect(fetchCallCount).toBe(3);
    });
  });

  // 6. 429: a typed error, no sleep and no retry (CLN-033) ───────────────────
  describe('429 rate limit', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    /** Token call succeeds, every later call answers 429 with `retryAfter` (null: no header). */
    function stubRateLimited(retryAfter: string | null) {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/token/new/')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(makeTokenResponse()),
            text: () => Promise.resolve(''),
          });
        }

        return Promise.resolve({
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === 'Retry-After' ? retryAfter : null) },
          json: () => Promise.resolve({}),
          text: () => Promise.resolve('rate limited'),
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      return fetchMock;
    }

    it('throws BankRateLimitedError with an HTTP-date Retry-After, after one call', async () => {
      const fetchMock = stubRateLimited('Mon, 26 Oct 2026 13:30:00 GMT');

      const result = makeConnector().listSupportedBanks('PL');

      await expect(result).rejects.toBeInstanceOf(BankRateLimitedError);
      await expect(result).rejects.toMatchObject({
        code: 'rate_limited',
        retryAfter: new Date('2026-10-26T13:30:00Z'),
      });
      // token + one institutions call: no retry loop.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reads a delta-seconds Retry-After from now', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
      stubRateLimited('120');

      await expect(makeConnector().listSupportedBanks('PL')).rejects.toMatchObject({
        retryAfter: new Date('2026-10-26T12:02:00Z'),
      });
    });

    it('has no retry time when the provider gives none', async () => {
      stubRateLimited(null);

      await expect(makeConnector().listSupportedBanks('PL')).rejects.toMatchObject({
        retryAfter: null,
      });
    });
  });
});

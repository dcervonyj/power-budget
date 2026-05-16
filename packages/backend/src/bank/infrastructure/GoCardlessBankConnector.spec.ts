import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EncryptedString } from '@power-budget/core';
import type { Encryption } from '../../auth/domain/ports.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';

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
        accountExternalId: 'acct-1',
        consent,
        since: new Date('2024-03-01'),
      });

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        externalId: 'tx-001',
        accountExternalId: 'acct-1',
        occurredOn: '2024-03-15',
        amountMinor: -4250n,
        currency: 'PLN',
        description: 'BIEDRONKA 1234',
        merchant: 'Biedronka',
      });

      expect(result[1]).toEqual({
        externalId: null,
        accountExternalId: 'acct-1',
        occurredOn: '2024-03-14',
        amountMinor: 100000n,
        currency: 'PLN',
        description: 'Salary March',
        merchant: null,
      });
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

  // 6. 429 retry logic ────────────────────────────────────────────────────────
  describe('429 retry logic', () => {
    it('retries after Retry-After delay and succeeds on the next attempt', async () => {
      const institutions = [{ id: 'BANK_1', name: 'Bank 1', countries: ['PL'], logo: null }];

      let fetchCallCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          fetchCallCount++;

          const isTokenEndpoint = url.includes('/token/new/');

          // Token endpoint always succeeds
          if (isTokenEndpoint) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              json: () => Promise.resolve(makeTokenResponse()),
              text: () => Promise.resolve(JSON.stringify(makeTokenResponse())),
            });
          }

          // First institutions call → 429 with Retry-After: 0
          if (fetchCallCount === 2) {
            return Promise.resolve({
              ok: false,
              status: 429,
              headers: {
                get: (name: string) => (name === 'Retry-After' ? '0' : null),
              },
              json: () => Promise.resolve({}),
              text: () => Promise.resolve('rate limited'),
            });
          }

          // Second institutions call → success
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve(institutions),
            text: () => Promise.resolve(JSON.stringify(institutions)),
          });
        }),
      );

      const connector = makeConnector();
      const result = await connector.listSupportedBanks('PL');

      // token (1) + 429 (2) + success (3)
      expect(fetchCallCount).toBe(3);
      expect(result).toHaveLength(1);
      expect(result[0]?.bankId).toBe('BANK_1');
    });

    it('throws after exhausting all retries on repeated 429s', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          const isTokenEndpoint = url.includes('/token/new/');

          if (isTokenEndpoint) {
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
            headers: { get: (name: string) => (name === 'Retry-After' ? '0' : null) },
            json: () => Promise.resolve({}),
            text: () => Promise.resolve('rate limited'),
          });
        }),
      );

      const connector = makeConnector();

      await expect(connector.listSupportedBanks('PL')).rejects.toThrow('rate limited');
    });
  });
});

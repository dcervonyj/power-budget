import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BankConnectionId, EncryptedString } from '@power-budget/core';
import { WiseBankConnector } from './WiseBankConnector.js';
import type { Encryption } from '../../domain/auth/ports.js';

const FAKE_TOKEN = 'test-wise-api-token';
const FAKE_CONNECTION_ID = 'conn-abc' as unknown as BankConnectionId;
const FAKE_ENCRYPTED = 'encrypted-token' as EncryptedString;

const mockEncryption: Encryption = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

function mockFetchOnce(...responses: unknown[]) {
  let call = 0;
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const data = responses[call++];

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(data),
    });
  });
}

describe('WiseBankConnector', () => {
  let connector: WiseBankConnector;

  beforeEach(() => {
    vi.resetAllMocks();
    connector = new WiseBankConnector(mockEncryption, 'https://api.wise.test');
    vi.mocked(mockEncryption.decrypt).mockResolvedValue(FAKE_TOKEN);
    vi.mocked(mockEncryption.encrypt).mockResolvedValue(FAKE_ENCRYPTED);
  });

  describe('listSupportedBanks', () => {
    it('returns a single Wise entry for the requested country', async () => {
      const result = await connector.listSupportedBanks('GB');

      expect(result).toEqual([
        {
          bankId: 'wise',
          name: 'Wise',
          countryCode: 'GB',
          logoUrl: 'https://wise.com/favicon.ico',
        },
      ]);
    });
  });

  describe('initiateConsent', () => {
    it('returns wise-connect URL and wise-pending ref without calling the API', async () => {
      const result = await connector.initiateConsent();

      expect(result).toEqual({
        consentUrl: 'wise-connect://token-entry',
        externalConsentRef: 'wise-pending',
      });
    });
  });

  describe('completeConsent', () => {
    it('encrypts the apiToken from callbackPayload and returns null expiry', async () => {
      const result = await connector.completeConsent({
        externalConsentRef: 'wise-pending',
        callbackPayload: { apiToken: FAKE_TOKEN },
      });

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(FAKE_TOKEN);
      expect(result).toEqual({ consentToken: FAKE_ENCRYPTED, expiresAt: null });
    });

    it('throws when apiToken is absent from callbackPayload', async () => {
      await expect(
        connector.completeConsent({
          externalConsentRef: 'wise-pending',
          callbackPayload: {},
        }),
      ).rejects.toThrow('missing apiToken');
    });
  });

  describe('listAccounts', () => {
    it('fetches personal profile and borderless accounts, maps each balance to RawBankAccount', async () => {
      const profiles = [
        { id: 111, type: 'personal' },
        { id: 222, type: 'business' },
      ];
      const accounts = [
        {
          id: 99,
          balances: [
            {
              currency: 'USD',
              amount: { value: 150.5, currency: 'USD' },
              bankDetails: { iban: null },
            },
            {
              currency: 'PLN',
              amount: { value: 500.0, currency: 'PLN' },
              bankDetails: { iban: 'PL61109010140000071219812874' },
            },
          ],
        },
      ];

      mockFetchOnce(profiles, accounts);

      const result = await connector.listAccounts(FAKE_CONNECTION_ID, FAKE_ENCRYPTED);

      expect(mockEncryption.decrypt).toHaveBeenCalledWith(FAKE_ENCRYPTED);
      const fetchMock = vi.mocked(globalThis.fetch);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/v1/profiles');
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
        '/v2/borderless-accounts?profileId=111',
      );

      expect(result).toEqual([
        {
          externalId: '99-USD',
          name: 'Wise USD',
          iban: null,
          currency: 'USD',
          balanceMinor: 15050n,
        },
        {
          externalId: '99-PLN',
          name: 'Wise PLN',
          iban: 'PL61109010140000071219812874',
          currency: 'PLN',
          balanceMinor: 50000n,
        },
      ]);
    });

    it('returns empty array when no personal profile exists', async () => {
      mockFetchOnce([{ id: 222, type: 'business' }]);

      const result = await connector.listAccounts(FAKE_CONNECTION_ID, FAKE_ENCRYPTED);

      expect(result).toEqual([]);
    });
  });

  describe('fetchTransactions', () => {
    it('fetches profile then statement, maps transactions to RawTransaction', async () => {
      const profiles = [{ id: 111, type: 'personal' }];
      const statement = {
        transactions: [
          {
            type: 'DEBIT',
            date: '2024-01-15T10:00:00Z',
            amount: { value: -25.99, currency: 'USD' },
            details: { description: 'Netflix', paymentReference: '' },
            referenceNumber: 'REF-001',
          },
          {
            type: 'CREDIT',
            date: '2024-01-16T12:00:00Z',
            amount: { value: 100.0, currency: 'USD' },
            details: { description: '', paymentReference: 'Salary payment' },
            referenceNumber: 'REF-002',
          },
        ],
      };

      mockFetchOnce(profiles, statement);

      const result = await connector.fetchTransactions({
        accountExternalId: '99-USD',
        consent: FAKE_ENCRYPTED,
        since: new Date('2024-01-01T00:00:00Z'),
      });

      const fetchMock = vi.mocked(globalThis.fetch);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const statementUrl = String(fetchMock.mock.calls[1]?.[0]);
      expect(statementUrl).toContain('/v3/profiles/111/borderless-accounts/99/statement.json');
      expect(statementUrl).toContain('currency=USD');
      expect(statementUrl).toContain('intervalStart=2024-01-01T00:00:00Z');

      expect(result).toEqual([
        {
          externalId: 'REF-001',
          accountExternalId: '99-USD',
          occurredOn: '2024-01-15',
          amountMinor: -2599n,
          currency: 'USD',
          description: 'Netflix',
          merchant: null,
        },
        {
          externalId: 'REF-002',
          accountExternalId: '99-USD',
          occurredOn: '2024-01-16',
          amountMinor: 10000n,
          currency: 'USD',
          description: 'Salary payment',
          merchant: null,
        },
      ]);
    });

    it('falls back to paymentReference when description is empty', async () => {
      const profiles = [{ id: 111, type: 'personal' }];
      const statement = {
        transactions: [
          {
            type: 'CREDIT',
            date: '2024-03-01T08:00:00Z',
            amount: { value: 200.0, currency: 'EUR' },
            details: { paymentReference: 'Freelance invoice' },
            referenceNumber: 'REF-003',
          },
        ],
      };

      mockFetchOnce(profiles, statement);

      const result = await connector.fetchTransactions({
        accountExternalId: '99-EUR',
        consent: FAKE_ENCRYPTED,
        since: new Date('2024-01-01T00:00:00Z'),
      });

      expect(result[0]?.description).toBe('Freelance invoice');
    });

    it('returns empty array when no personal profile exists', async () => {
      mockFetchOnce([{ id: 222, type: 'business' }]);

      const result = await connector.fetchTransactions({
        accountExternalId: '99-USD',
        consent: FAKE_ENCRYPTED,
        since: new Date('2024-01-01T00:00:00Z'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('refreshConsent', () => {
    it('throws because Wise tokens do not expire', async () => {
      await expect(connector.refreshConsent()).rejects.toThrow('Wise tokens do not expire');
    });
  });

  describe('disconnect', () => {
    it('resolves without error (no-op)', async () => {
      await expect(connector.disconnect()).resolves.toBeUndefined();
    });
  });
});

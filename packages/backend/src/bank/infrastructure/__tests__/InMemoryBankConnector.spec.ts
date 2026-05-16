import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryBankConnector } from '../InMemoryBankConnector.js';

describe('InMemoryBankConnector', () => {
  let connector: InMemoryBankConnector;

  beforeEach(() => {
    connector = new InMemoryBankConnector();
  });

  it('provider is gocardless', () => {
    expect(connector.provider).toBe('gocardless');
  });

  it('listSupportedBanks returns seeded Polish banks for PL', async () => {
    const banks = await connector.listSupportedBanks('PL');
    expect(banks.length).toBeGreaterThan(0);
    expect(banks.every((b) => b.countryCode === 'PL')).toBe(true);
  });

  it('listSupportedBanks returns empty array for country with no banks', async () => {
    const banks = await connector.listSupportedBanks('DE');
    expect(banks).toEqual([]);
  });

  it('initiateConsent returns a consent URL and externalConsentRef', async () => {
    const result = await connector.initiateConsent({
      userId: 'user-1',
      bankId: 'PKO_PLPKOPPLPW',
      redirectUri: 'https://app.test/callback',
      historyDays: 90,
    });

    expect(result.consentUrl).toMatch(/^https:\/\/mock\.gocardless\.test/);
    expect(result.externalConsentRef).toContain('inmem-ref-');
  });

  it('completeConsent returns a consent token and expiry', async () => {
    const result = await connector.completeConsent({
      externalConsentRef: 'ref-123',
      callbackPayload: { code: 'auth-code', state: 'ref-123' },
    });

    expect(result.consentToken).toContain('inmem-token:');
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('fetchTransactions returns empty array', async () => {
    const txs = await connector.fetchTransactions();
    expect(txs).toEqual([]);
  });
});

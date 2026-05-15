import { describe, it, expect } from 'vitest';
import { ConsentExpiryPolicy } from './consent-expiry-policy.js';
import type {
  BankConnection,
  BankConnectionId,
  HouseholdId,
  UserId,
  EncryptedString,
} from './entities.js';

function makeConn(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: 'conn-1' as BankConnectionId,
    householdId: 'hh-1' as HouseholdId,
    userId: 'u-1' as UserId,
    provider: 'gocardless',
    bankId: 'BPKOPLPW',
    externalConsentRef: 'ref-1',
    encryptedConsent: 'encrypted' as EncryptedString,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const NOW = new Date('2024-03-15T12:00:00Z');

describe('ConsentExpiryPolicy', () => {
  it('returns null when connection has no expiresAt', () => {
    expect(ConsentExpiryPolicy.evaluate(makeConn({ expiresAt: null }), NOW)).toBeNull();
  });

  it('returns null for disconnected connections', () => {
    const conn = makeConn({
      expiresAt: new Date(NOW.getTime() + 1000),
      status: 'disconnected',
    });
    expect(ConsentExpiryPolicy.evaluate(conn, NOW)).toBeNull();
  });

  it('returns null when consent is active and > 7 days away', () => {
    const conn = makeConn({
      expiresAt: new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000),
    });
    expect(ConsentExpiryPolicy.evaluate(conn, NOW)).toBeNull();
  });

  it('returns seven_days when within 7-day window', () => {
    const conn = makeConn({
      expiresAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000),
    });
    expect(ConsentExpiryPolicy.evaluate(conn, NOW)).toBe('seven_days');
  });

  it('returns one_day when within 1-day window', () => {
    const conn = makeConn({
      expiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000), // 12 hours
    });
    expect(ConsentExpiryPolicy.evaluate(conn, NOW)).toBe('one_day');
  });

  it('returns expired when past expiresAt', () => {
    const conn = makeConn({
      expiresAt: new Date(NOW.getTime() - 1000),
    });
    expect(ConsentExpiryPolicy.evaluate(conn, NOW)).toBe('expired');
  });

  it('isExpired returns true past expiry', () => {
    const conn = makeConn({ expiresAt: new Date(NOW.getTime() - 1) });
    expect(ConsentExpiryPolicy.isExpired(conn, NOW)).toBe(true);
  });

  it('isExpired returns false before expiry', () => {
    const conn = makeConn({ expiresAt: new Date(NOW.getTime() + 1000) });
    expect(ConsentExpiryPolicy.isExpired(conn, NOW)).toBe(false);
  });

  it('expiresWithin returns true when within window', () => {
    const conn = makeConn({ expiresAt: new Date(NOW.getTime() + 3 * 60 * 60 * 1000) });
    expect(ConsentExpiryPolicy.expiresWithin(conn, 6 * 60 * 60 * 1000, NOW)).toBe(true);
  });
});

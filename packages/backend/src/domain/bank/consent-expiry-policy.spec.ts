import { describe, it, expect } from 'vitest';
import { ConsentExpiryPolicy } from './consent-expiry-policy.js';
import { BankConnectionId, HouseholdId, UserId, EncryptedString } from '@power-budget/core';
import type { BankConnection } from './entities.js';

function makeConn(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: BankConnectionId.of('01900000-78db-7ecf-8203-561e43789f28'),
    householdId: HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6'),
    userId: UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768'),
    provider: 'gocardless',
    bankId: 'BPKOPLPW',
    externalConsentRef: 'ref-1',
    encryptedConsent: EncryptedString.of('encrypted'),
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

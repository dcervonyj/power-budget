import { describe, expect, it } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import type { BankConnection } from '../../infrastructure/api/BankConnectionMapper.js';
import { connectionsToRenew, consentStateOf } from './ConsentRenewal.js';

const NOW = new Date('2026-10-27T12:00:00.000Z');

function connection(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: 'conn-1',
    bankId: 'PKO_BPKOPLPW',
    provider: 'gocardless',
    status: 'active',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('consentStateOf', () => {
  it('is active when the consent runs for more than a week', () => {
    expect(consentStateOf(connection(), NOW)).toEqual({ kind: 'active' });
  });

  it('is active without an expiry date', () => {
    expect(consentStateOf(connection({ expiresAt: null }), NOW)).toEqual({ kind: 'active' });
  });

  it('counts whole days left inside the renewal window', () => {
    const expiresAt = new Date('2026-10-30T00:00:00.000Z');

    expect(consentStateOf(connection({ expiresAt }), NOW)).toEqual({
      kind: 'expiring',
      daysLeft: 3,
    });
  });

  it('is expired when the status says so or the date has passed', () => {
    expect(consentStateOf(connection({ status: 'expired' }), NOW)).toEqual({ kind: 'expired' });
    expect(
      consentStateOf(connection({ expiresAt: new Date('2026-10-01T00:00:00.000Z') }), NOW),
    ).toEqual({ kind: 'expired' });
  });

  it('keeps reconnect-required and disconnected apart from expiry', () => {
    expect(consentStateOf(connection({ status: 'reconnect_required' }), NOW)).toEqual({
      kind: 'reconnect',
    });
    expect(consentStateOf(connection({ status: 'disconnected' }), NOW)).toEqual({
      kind: 'disconnected',
    });
  });
});

describe('connectionsToRenew', () => {
  it('lists expiring and expired connections only', () => {
    const expiring = connection({ id: 'a', expiresAt: new Date('2026-10-30T00:00:00.000Z') });
    const expired = connection({ id: 'b', status: 'expired' });
    const fine = connection({ id: 'c' });
    const failed = connection({ id: 'd', status: 'reconnect_required' });

    expect(connectionsToRenew([expiring, expired, fine, failed], NOW)).toEqual([expiring, expired]);
  });
});

import { describe, it, expect } from 'vitest';
import { ACCOUNT_THROTTLER, AUTH_THROTTLERS, IP_THROTTLER, accountKey } from '../throttling.js';

describe('auth throttling', () => {
  it('defines a per-IP and a per-account throttler', () => {
    expect(AUTH_THROTTLERS.map((throttler) => throttler.name)).toEqual([
      IP_THROTTLER,
      ACCOUNT_THROTTLER,
    ]);
  });

  describe('accountKey', () => {
    it('keys on the normalised body email', () => {
      expect(accountKey({ body: { email: '  Alice@Example.COM ' } })).toBe(
        'email:alice@example.com',
      );
    });

    it('falls back to the authenticated user', () => {
      expect(accountKey({ body: { code: '123456' }, user: { userId: 'u-1' } })).toBe('user:u-1');
    });

    it('prefers the body email over the user', () => {
      expect(accountKey({ body: { email: 'a@b.co' }, user: { userId: 'u-1' } })).toBe(
        'email:a@b.co',
      );
    });

    it('is null without an email or user (throttler skipped)', () => {
      expect(accountKey({ body: { token: 'abc' } })).toBeNull();
      expect(accountKey({ body: { email: 42 } })).toBeNull();
      expect(accountKey({ body: { email: '   ' } })).toBeNull();
      expect(accountKey({})).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { HouseholdInvariants } from './invariants.js';

describe('HouseholdInvariants', () => {
  const mockMembership = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    householdId: 'hh-1' as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userId: 'u-1' as any,
    role: 'member' as const,
    joinedAt: new Date(),
  };

  describe('assertSingleHousehold', () => {
    it('passes when user has no memberships', () => {
      expect(() => HouseholdInvariants.assertSingleHousehold([])).not.toThrow();
    });

    it('throws when user already has a household', () => {
      expect(() => HouseholdInvariants.assertSingleHousehold([mockMembership])).toThrow(
        'MVP_SINGLE_HOUSEHOLD',
      );
    });
  });

  describe('assertInviteNotExpired', () => {
    it('passes for future expiry', () => {
      const future = new Date(Date.now() + 1000 * 60);
      expect(() =>
        HouseholdInvariants.assertInviteNotExpired({ expiresAt: future }, new Date()),
      ).not.toThrow();
    });

    it('throws for past expiry', () => {
      const past = new Date(Date.now() - 1000);
      expect(() =>
        HouseholdInvariants.assertInviteNotExpired({ expiresAt: past }, new Date()),
      ).toThrow('INVITE_EXPIRED');
    });
  });

  describe('assertInviteNotUsed', () => {
    it('passes when invite not yet used', () => {
      expect(() => HouseholdInvariants.assertInviteNotUsed({ acceptedAt: null })).not.toThrow();
    });

    it('throws when invite already accepted', () => {
      expect(() => HouseholdInvariants.assertInviteNotUsed({ acceptedAt: new Date() })).toThrow(
        'INVITE_ALREADY_USED',
      );
    });
  });
});

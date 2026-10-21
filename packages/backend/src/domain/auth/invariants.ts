import type { HouseholdMembership } from './entities.js';

/** MVP: a household is a couple (docs/mvp/PRODUCT.md: "two users, you + partner"). */
export const MAX_HOUSEHOLD_MEMBERS = 2;

/** docs/mvp/ARCHITECTURE.md: an invite is single-use, bound to an email, valid 7 days. */
export const HOUSEHOLD_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class HouseholdInvariants {
  /**
   * MVP invariant: each user belongs to at most one household.
   * The data model is N:M from day one; the invariant is enforced at application level.
   */
  static assertSingleHousehold(existingMemberships: HouseholdMembership[]): void {
    if (existingMemberships.length > 0) {
      throw new Error(
        'MVP_SINGLE_HOUSEHOLD: User is already a member of a household. ' +
          'Multi-household support is planned for v2.',
      );
    }
  }

  static assertInviteNotExpired(invite: { expiresAt: Date }, now: Date): void {
    if (invite.expiresAt < now) {
      throw new Error('INVITE_EXPIRED: This household invite has expired.');
    }
  }

  static assertInviteNotUsed(invite: { acceptedAt: Date | null }): void {
    if (invite.acceptedAt !== null) {
      throw new Error('INVITE_ALREADY_USED: This invite has already been accepted.');
    }
  }
}

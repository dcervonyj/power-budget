import type { UserId, HouseholdId, SessionId, EncryptedString } from '@power-budget/core';

export type LocaleCode = 'en' | 'uk' | 'ru' | 'pl';
export type HouseholdRole = 'owner' | 'member';
export type AuthMethodKind = 'password' | 'google' | 'magic_link';

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly localePreference: LocaleCode | null;
  readonly defaultLocale: LocaleCode;
  readonly passwordHash: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewUser {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly defaultLocale: LocaleCode;
  readonly passwordHash?: string | null;
}

export interface Household {
  readonly id: HouseholdId;
  readonly name: string;
  readonly baseCurrency: string;
  readonly createdAt: Date;
}

export interface NewHousehold {
  readonly id: HouseholdId;
  readonly name: string;
  readonly baseCurrency: string;
}

export interface HouseholdMembership {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly role: HouseholdRole;
  readonly joinedAt: Date;
}

/** A member of a household with the user details the household screen shows (UI-013). */
export interface HouseholdMember {
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly role: HouseholdRole;
  readonly joinedAt: Date;
}

export interface Session {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly refreshTokenHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface TotpSecret {
  readonly userId: UserId;
  /** Ciphertext from the Encryption port (context `totp:<userId>`), never the plain secret. */
  readonly encryptedSecret: EncryptedString;
  readonly enrolledAt: Date;
  /** Set by the first accepted code; TOTP counts as enabled only from then on. */
  readonly verifiedAt: Date | null;
  /** Last accepted TOTP time step (replay protection). */
  readonly lastUsedTimeStep: number | null;
  /**
   * A replacement secret (ciphertext, same context) waiting for its first valid
   * code (CLN-032). Login and step-up never read it: until it is confirmed the
   * active secret above stays in force.
   */
  readonly pendingEncryptedSecret: EncryptedString | null;
}

export interface HouseholdInvite {
  readonly id: string; // UUID
  readonly householdId: HouseholdId;
  /** Lower-cased address the invite is bound to. */
  readonly email: string;
  /** sha256 of the single-use token; the raw token only ever travels in the email link. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
  readonly invitedByUserId: UserId | null;
  readonly revokedAt: Date | null;
}

export type NewHouseholdInvite = Omit<HouseholdInvite, 'createdAt' | 'acceptedAt' | 'revokedAt'>;

/**
 * Accepting an invite, applied atomically by the repository (CLN-006):
 * - the invite must still be open (not accepted, not revoked, not expired at `at`);
 * - the household must have fewer than `maxMembers` members;
 * - `leaveHouseholdId`: the accepting user's own solo household. They leave it (it is
 *   scheduled for deletion) only if it holds no data; otherwise nothing changes.
 */
export interface AcceptInviteCommand {
  readonly inviteId: string;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly leaveHouseholdId: HouseholdId | null;
  readonly maxMembers: number;
  readonly at: Date;
}

export type AcceptInviteOutcome =
  'joined' | 'invite_unavailable' | 'household_full' | 'household_not_empty';

export interface RequestContext {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly locale: LocaleCode;
}

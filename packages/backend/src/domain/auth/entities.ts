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
}

export interface HouseholdInvite {
  readonly id: string; // UUID
  readonly householdId: HouseholdId;
  readonly email: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export interface RequestContext {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly locale: LocaleCode;
}

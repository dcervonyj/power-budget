import type { UserId, HouseholdId, SessionId } from '@power-budget/core';

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
  readonly encryptedSecret: string;
  readonly enrolledAt: Date;
  readonly verifiedAt: Date | null;
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

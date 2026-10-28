import { HouseholdInviteId } from '@power-budget/core';
import { HouseholdId, UserId } from '@power-budget/core';
import type {
  Household,
  HouseholdInvite,
  HouseholdMembership,
  User,
} from '../../domain/auth/entities.js';

export const OWNER_ID = UserId.of('01900000-0000-7000-8000-00000000000a');
export const PARTNER_ID = UserId.of('01900000-0000-7000-8000-00000000000b');
export const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
export const SOLO_HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-0000000000b1');
export const INVITE_ID = HouseholdInviteId.of('01900000-0000-7000-8000-0000000000c1');
export const OWNER_EMAIL = 'ann@example.com';
export const PARTNER_EMAIL = 'bob@example.com';

const DAY_MS = 24 * 60 * 60 * 1000;

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: OWNER_ID,
    email: OWNER_EMAIL,
    displayName: 'Ann',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: HOUSEHOLD_ID,
    name: "Ann's household",
    baseCurrency: 'PLN',
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeMembership(
  role: 'owner' | 'member',
  overrides: Partial<HouseholdMembership> = {},
): HouseholdMembership {
  return { householdId: HOUSEHOLD_ID, userId: OWNER_ID, role, joinedAt: new Date(), ...overrides };
}

export function makeInvite(overrides: Partial<HouseholdInvite> = {}): HouseholdInvite {
  return {
    id: INVITE_ID,
    householdId: HOUSEHOLD_ID,
    email: PARTNER_EMAIL,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 7 * DAY_MS),
    acceptedAt: null,
    createdAt: new Date(),
    invitedByUserId: OWNER_ID,
    revokedAt: null,
    ...overrides,
  };
}

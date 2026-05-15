import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  User,
  NewUser,
  Household,
  NewHousehold,
  HouseholdMembership,
  HouseholdInvite,
  LocaleCode,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  updateLocalePreference(id: UserId, locale: LocaleCode): Promise<void>;
}

export interface HouseholdRepository {
  findById(id: HouseholdId): Promise<Household | null>;
  create(household: NewHousehold): Promise<Household>;
  addMember(
    householdId: HouseholdId,
    userId: UserId,
    role: 'owner' | 'member',
  ): Promise<HouseholdMembership>;
  findMembership(householdId: HouseholdId, userId: UserId): Promise<HouseholdMembership | null>;
  findByUserId(userId: UserId): Promise<Household | null>;
}

export interface PasswordHashing {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export interface TotpVerifier {
  generateSecret(label: string): { secret: string; otpauthUri: string };
  verify(secret: string, code: string, window?: number): boolean;
}

export interface OAuthProvider {
  buildAuthorizeUrl(state: string, redirectUri: string): string;
  exchange(
    code: string,
    redirectUri: string,
  ): Promise<{ email: string; subject: string; emailVerified: boolean }>;
}

export interface RefreshTokenStore {
  issue(userId: UserId, ttlSeconds: number): Promise<string>;
  rotate(oldToken: string): Promise<{ userId: UserId; newToken: string } | null>;
  revoke(token: string): Promise<void>;
}

export interface TotpSecretRepository {
  findByUser(userId: UserId): Promise<import('./entities.js').TotpSecret | null>;
  save(secret: import('./entities.js').TotpSecret): Promise<void>;
  delete(userId: UserId): Promise<void>;
}

export interface HouseholdInviteRepository {
  create(invite: Omit<HouseholdInvite, 'createdAt'>): Promise<HouseholdInvite>;
  findByTokenHash(tokenHash: string): Promise<HouseholdInvite | null>;
  accept(id: string, at: Date): Promise<void>;
}

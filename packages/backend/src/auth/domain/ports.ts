import type { UserId, HouseholdId, EncryptedString, HouseholdExportId } from '@power-budget/core';
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
  scheduleDelete(id: HouseholdId, scheduledFor: Date): Promise<void>;
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

export interface JwtAccessTokenIssuer {
  issue(payload: { userId: UserId; householdId: HouseholdId | null }): string;
}

export interface MagicLinkTokenRepository {
  save(token: { tokenHash: string; userId: UserId; expiresAt: Date }): Promise<void>;
  /** Returns null if token is expired, not found, or already consumed. */
  consume(tokenHash: string): Promise<{ userId: UserId } | null>;
}

export interface NotificationOutboxPort {
  enqueue(event: {
    kind: string;
    userId: UserId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void>;
}

export interface BankConnectionChecker {
  hasActiveConnection(userId: UserId): Promise<boolean>;
}

export interface Encryption {
  encrypt(plaintext: string, context?: string): Promise<EncryptedString>;
  decrypt(ciphertext: EncryptedString, context?: string): Promise<string>;
}

export interface AppConfigPort {
  get(key: 'APP_BASE_URL'): string;
}

export interface TotpStepUpStore {
  /** Records that userId just verified TOTP. TTL is enforced by the implementation. */
  stamp(userId: UserId): Promise<void>;
  /** Returns true if userId verified TOTP within the configured TTL window. */
  isRecent(userId: UserId): Promise<boolean>;
}

export interface HouseholdExport {
  readonly id: HouseholdExportId;
  readonly householdId: HouseholdId;
  readonly requestedByUserId: UserId;
  readonly status: 'pending' | 'processing' | 'ready' | 'failed';
  readonly downloadUrl: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface HouseholdExportRepository {
  create(input: {
    id: HouseholdExportId;
    householdId: HouseholdId;
    requestedByUserId: UserId;
  }): Promise<HouseholdExport>;
  updateStatus(
    id: HouseholdExportId,
    update: { status: 'processing' | 'ready' | 'failed'; downloadUrl?: string; expiresAt?: Date },
  ): Promise<void>;
  findById(id: HouseholdExportId): Promise<HouseholdExport | null>;
}

export interface HouseholdExportQueuePort {
  enqueue(payload: { exportId: HouseholdExportId; householdId: HouseholdId }): Promise<void>;
}

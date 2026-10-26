import type { UserId, HouseholdId, EncryptedString, HouseholdExportId } from '@power-budget/core';
import type {
  User,
  NewUser,
  Household,
  NewHousehold,
  HouseholdMembership,
  HouseholdMember,
  HouseholdInvite,
  NewHouseholdInvite,
  AcceptInviteCommand,
  AcceptInviteOutcome,
  LocaleCode,
  TotpSecret,
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
  countMembers(householdId: HouseholdId): Promise<number>;
  /** The members in join order, with their email and display name. */
  listMembers(householdId: HouseholdId): Promise<HouseholdMember[]>;
  scheduleDelete(id: HouseholdId, scheduledFor: Date): Promise<void>;
}

/** What one purge removed (CLN-022). */
export interface HouseholdPurgeResult {
  readonly householdId: HouseholdId;
  /** Former members with no remaining household, whose account was deleted too. */
  readonly deletedUserIds: readonly UserId[];
}

/** GDPR hard delete of households whose grace period has passed (runs in the worker only). */
export interface HouseholdPurgeRepository {
  /** Households whose `delete_scheduled_at` is at or before `now`, oldest first, minus `excludeIds`. */
  findDueHouseholdIds(
    now: Date,
    limit: number,
    excludeIds: readonly HouseholdId[],
  ): Promise<HouseholdId[]>;
  /**
   * Deletes the household's data, memberships and the household in one transaction, then the
   * accounts of former members left without a household. Returns null when the household is
   * gone or no longer due (deletion cancelled meanwhile).
   */
  purge(householdId: HouseholdId, now: Date): Promise<HouseholdPurgeResult | null>;
}

export interface PasswordHashing {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export interface TotpVerifier {
  generateSecret(label: string): { secret: string; otpauthUri: string };
  /**
   * Checks `code` against the plaintext `secret`. Returns the matched TOTP time
   * step, or null when the code is wrong or its step is not after `afterTimeStep`
   * (replay protection, audit M9).
   */
  verify(secret: string, code: string, afterTimeStep: number | null): number | null;
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
  /** Atomic: of two concurrent rotations of the same token only one succeeds. */
  rotate(oldToken: string): Promise<{ userId: UserId; newToken: string } | null>;
  revoke(token: string): Promise<void>;
}

export interface TotpSecretRepository {
  findByUser(userId: UserId): Promise<TotpSecret | null>;
  /** Upsert of a (re-)enrolment: replaces the secret and resets verifiedAt and lastUsedTimeStep. */
  save(secret: TotpSecret): Promise<void>;
  /**
   * Atomically records `timeStep` as used (and sets verifiedAt if still null).
   * Returns false when a step >= `timeStep` was already used, so a code can
   * never be accepted twice, not even by two concurrent requests.
   */
  claimTimeStep(userId: UserId, timeStep: number, verifiedAt: Date): Promise<boolean>;
  delete(userId: UserId): Promise<void>;
}

export interface HouseholdInviteRepository {
  /** Revokes the household's open invite (if any) and inserts this one, atomically. */
  replaceOpen(invite: NewHouseholdInvite, at: Date): Promise<HouseholdInvite>;
  findByTokenHash(tokenHash: string): Promise<HouseholdInvite | null>;
  /** An invite of this household, or null (an id of another household reads as missing). */
  findInHousehold(id: string, householdId: HouseholdId): Promise<HouseholdInvite | null>;
  /** Not accepted and not revoked (expired ones included, so they can be resent). */
  listOpen(householdId: HouseholdId): Promise<HouseholdInvite[]>;
  /** False when the invite is not open in this household. */
  revoke(id: string, householdId: HouseholdId, at: Date): Promise<boolean>;
  /** New token and expiry for an open invite (resend). Null when it is not open. */
  rotateToken(
    id: string,
    householdId: HouseholdId,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<HouseholdInvite | null>;
  acceptAndJoin(command: AcceptInviteCommand): Promise<AcceptInviteOutcome>;
}

export interface JwtAccessTokenIssuer {
  issue(payload: { userId: UserId; householdId: HouseholdId | null }): string;
}

export interface MagicLinkTokenRepository {
  save(token: { tokenHash: string; userId: UserId; expiresAt: Date }): Promise<void>;
  /** Reads a live token without consuming it. Null if expired, not found, or consumed. */
  find(tokenHash: string): Promise<{ userId: UserId } | null>;
  /**
   * Atomically deletes a live token and returns its user. Null if expired, not
   * found, or already consumed (of two concurrent calls only one gets the user).
   */
  consume(tokenHash: string): Promise<{ userId: UserId } | null>;
}

export interface NotificationOutboxPort {
  enqueue(event: {
    kind: string;
    userId: UserId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void>;
  /** For an address without an account (an invitee who has not registered yet). */
  enqueueToAddress(event: {
    kind: string;
    email: string;
    locale: LocaleCode;
    householdId: HouseholdId;
    payload: Record<string, unknown>;
    dedupeKey: string;
  }): Promise<void>;
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

/** One fixed window of a FailedAttemptCounter (CLN-031). */
export interface AttemptWindow {
  /** Attempts in the current window, this one included. */
  readonly attempts: number;
  /** Seconds until the window ends and the count starts again. */
  readonly secondsLeft: number;
}

/**
 * Counts attempts per key in a fixed window that opens at the first attempt
 * (CLN-031, audit BE-BUGS-02). Shared by every API instance.
 */
export interface FailedAttemptCounter {
  /** Atomically adds one attempt; of concurrent calls each sees its own count. */
  increment(key: string, windowSeconds: number): Promise<AttemptWindow>;
  reset(key: string): Promise<void>;
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
  findLatestByHousehold(householdId: HouseholdId): Promise<HouseholdExport | null>;
}

export interface HouseholdExportQueuePort {
  enqueue(payload: { exportId: HouseholdExportId; householdId: HouseholdId }): Promise<void>;
}

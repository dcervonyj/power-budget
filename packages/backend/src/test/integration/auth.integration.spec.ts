import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../drizzle/schema.js';
import { startContainers, stopContainers, getPool } from './setup.js';
import {
  withRollbackTransaction,
  makeUserId,
  makeHouseholdId,
  insertTestUser,
} from './test-helpers.js';
import { DrizzleUserRepository } from '../../infrastructure/auth/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../infrastructure/auth/DrizzleHouseholdRepository.js';
import { DrizzleMagicLinkTokenRepository } from '../../infrastructure/auth/DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from '../../infrastructure/auth/DrizzleHouseholdInviteRepository.js';
import { UserId, HouseholdId, EncryptedString } from '@power-budget/core';

type DB = NodePgDatabase<typeof schema>;

describe('Integration: auth infrastructure adapters', () => {
  beforeAll(async () => {
    await startContainers();
  }, 90_000);

  afterAll(async () => {
    await stopContainers();
  }, 30_000);

  // ─── DrizzleUserRepository ──────────────────────────────────────────────────

  describe('DrizzleUserRepository', () => {
    it('creates and finds a user by id', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const id = UserId.of(makeUserId());

        const created = await users.create({
          id,
          email: 'alice@example.com',
          displayName: 'Alice',
          defaultLocale: 'en',
          passwordHash: null,
        });

        expect(created.id).toBe(id);
        expect(created.email).toBe('alice@example.com');
        expect(created.passwordHash).toBeNull();

        const found = await users.findById(id);
        expect(found).not.toBeNull();
        expect(found!.email).toBe('alice@example.com');
      });
    });

    it('finds a user by email (case-insensitive)', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const id = UserId.of(makeUserId());

        await users.create({
          id,
          email: 'Bob@Example.COM',
          displayName: 'Bob',
          defaultLocale: 'pl',
        });

        const found = await users.findByEmail('bob@example.com');
        expect(found).not.toBeNull();
        expect(found!.id).toBe(id);
      });
    });

    it('returns null when user not found', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const result = await users.findById(UserId.of(makeUserId()));
        expect(result).toBeNull();
      });
    });

    it('updates locale preference', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const id = UserId.of(makeUserId());

        await users.create({
          id,
          email: 'carol@example.com',
          displayName: 'Carol',
          defaultLocale: 'en',
        });

        await users.updateLocalePreference(id, 'uk');

        const found = await users.findById(id);
        expect(found!.localePreference).toBe('uk');
      });
    });
  });

  // ─── DrizzleHouseholdRepository ─────────────────────────────────────────────

  describe('DrizzleHouseholdRepository', () => {
    it('creates and finds a household by id', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const id = HouseholdId.of(makeHouseholdId());

        const created = await households.create({ id, name: 'Smith Family', baseCurrency: 'PLN' });
        expect(created.id).toBe(id);
        expect(created.name).toBe('Smith Family');

        const found = await households.findById(id);
        expect(found).not.toBeNull();
        expect(found!.baseCurrency).toBe('PLN');
      });
    });

    it('returns null for unknown household', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const result = await households.findById(HouseholdId.of(makeHouseholdId()));
        expect(result).toBeNull();
      });
    });

    it('adds a member and finds the membership', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const households = new DrizzleHouseholdRepository(db);

        const userId = UserId.of(makeUserId());
        const hhId = HouseholdId.of(makeHouseholdId());

        await users.create({
          id: userId,
          email: `member-${userId}@example.com`,
          displayName: 'Member',
          defaultLocale: 'en',
        });
        await households.create({ id: hhId, name: 'Test HH', baseCurrency: 'EUR' });

        const membership = await households.addMember(hhId, userId, 'owner');
        expect(membership.role).toBe('owner');
        expect(membership.userId).toBe(userId);

        const found = await households.findMembership(hhId, userId);
        expect(found).not.toBeNull();
        expect(found!.role).toBe('owner');
      });
    });

    it('findMembership returns null for non-member', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const hhId = HouseholdId.of(makeHouseholdId());
        const userId = UserId.of(makeUserId());
        await households.create({ id: hhId, name: 'HH', baseCurrency: 'USD' });

        const result = await households.findMembership(hhId, userId);
        expect(result).toBeNull();
      });
    });

    it('findByUserId returns the household of a member', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const households = new DrizzleHouseholdRepository(db);

        const userId = UserId.of(makeUserId());
        const hhId = HouseholdId.of(makeHouseholdId());

        await users.create({
          id: userId,
          email: `findby-${userId}@example.com`,
          displayName: 'FindByUser',
          defaultLocale: 'en',
        });
        await households.create({ id: hhId, name: 'Find HH', baseCurrency: 'PLN' });
        await households.addMember(hhId, userId, 'member');

        const hh = await households.findByUserId(userId);
        expect(hh).not.toBeNull();
        expect(hh!.id).toBe(hhId);
      });
    });

    it('findByUserId returns null when user has no household', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const result = await households.findByUserId(UserId.of(makeUserId()));
        expect(result).toBeNull();
      });
    });
  });

  // ─── DrizzleMagicLinkTokenRepository ────────────────────────────────────────

  describe('DrizzleMagicLinkTokenRepository', () => {
    it('saves and consumes a valid token', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const magicLinks = new DrizzleMagicLinkTokenRepository(db);

        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `magic-${userId}@example.com`,
          displayName: 'Magic',
          defaultLocale: 'en',
        });

        const tokenHash = createHash('sha256').update('secret-token-1').digest('hex');
        const expiresAt = new Date(Date.now() + 60_000);

        await magicLinks.save({ tokenHash, userId, expiresAt });

        const result = await magicLinks.consume(tokenHash);
        expect(result).not.toBeNull();
        expect(result!.userId).toBe(userId);

        // consuming again returns null (token deleted)
        const second = await magicLinks.consume(tokenHash);
        expect(second).toBeNull();
      });
    });

    it('returns null for an expired token', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const magicLinks = new DrizzleMagicLinkTokenRepository(db);

        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `expired-${userId}@example.com`,
          displayName: 'Expired',
          defaultLocale: 'en',
        });

        const tokenHash = createHash('sha256').update('expired-token').digest('hex');
        const expiresAt = new Date(Date.now() - 60_000); // already expired

        await magicLinks.save({ tokenHash, userId, expiresAt });

        const result = await magicLinks.consume(tokenHash);
        expect(result).toBeNull();
      });
    });

    it('returns null for an unknown token hash', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const magicLinks = new DrizzleMagicLinkTokenRepository(db);
        const result = await magicLinks.consume('nonexistent-hash');
        expect(result).toBeNull();
      });
    });

    it('find reads a live token without consuming it, and ignores expired ones', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const magicLinks = new DrizzleMagicLinkTokenRepository(db);
        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `find-${userId}@example.com`,
          displayName: 'Find',
          defaultLocale: 'en',
        });
        const live = createHash('sha256').update('live-token').digest('hex');
        const expired = createHash('sha256').update('old-token').digest('hex');
        await magicLinks.save({
          tokenHash: live,
          userId,
          expiresAt: new Date(Date.now() + 60_000),
        });
        await magicLinks.save({ tokenHash: expired, userId, expiresAt: new Date(Date.now() - 1) });

        expect(await magicLinks.find(live)).toEqual({ userId });
        expect(await magicLinks.find(live)).toEqual({ userId });
        expect(await magicLinks.find(expired)).toBeNull();
        expect(await magicLinks.consume(live)).toEqual({ userId });
        expect(await magicLinks.find(live)).toBeNull();
      });
    });
  });

  // ─── DrizzleTotpSecretRepository ────────────────────────────────────────────

  describe('DrizzleTotpSecretRepository', () => {
    it('saves and retrieves a TOTP secret', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);

        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `totp-${userId}@example.com`,
          displayName: 'TOTP User',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('enc-secret-abc'),
          enrolledAt: new Date(),
          verifiedAt: null,
          lastUsedTimeStep: null,
          pendingEncryptedSecret: null,
        });

        const found = await totpSecrets.findByUser(userId);
        expect(found).not.toBeNull();
        expect(found!.encryptedSecret).toBe('enc-secret-abc');
        expect(found!.verifiedAt).toBeNull();
      });
    });

    it('upserts TOTP secret (save twice)', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);

        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `totp2-${userId}@example.com`,
          displayName: 'TOTP2',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('old-secret'),
          enrolledAt: new Date(),
          verifiedAt: null,
          lastUsedTimeStep: null,
          pendingEncryptedSecret: null,
        });

        const verifiedAt = new Date();
        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('new-secret'),
          enrolledAt: new Date(),
          verifiedAt,
          lastUsedTimeStep: null,
          pendingEncryptedSecret: null,
        });

        const found = await totpSecrets.findByUser(userId);
        expect(found!.encryptedSecret).toBe('new-secret');
        expect(found!.verifiedAt).not.toBeNull();
      });
    });

    it('claims each time step once and only moving forward', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);
        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `claim-${userId}@example.com`,
          displayName: 'Claim',
          defaultLocale: 'en',
        });
        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('env-v1:aes-256-gcm:iv:ct:tag'),
          enrolledAt: new Date(),
          verifiedAt: null,
          lastUsedTimeStep: null,
          pendingEncryptedSecret: null,
        });
        const verifiedAt = new Date('2026-10-21T10:00:00.000Z');

        expect(await totpSecrets.claimTimeStep(userId, 100, verifiedAt)).toBe(true);
        expect(await totpSecrets.claimTimeStep(userId, 100, new Date())).toBe(false);
        expect(await totpSecrets.claimTimeStep(userId, 99, new Date())).toBe(false);
        expect(await totpSecrets.claimTimeStep(userId, 101, new Date())).toBe(true);

        const found = await totpSecrets.findByUser(userId);
        expect(found!.lastUsedTimeStep).toBe(101);
        // verifiedAt is set by the first claim and kept afterwards.
        expect(found!.verifiedAt).toEqual(verifiedAt);
      });
    });

    it('keeps the active secret while a replacement is pending and swaps it in atomically', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);
        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `pending-${userId}@example.com`,
          displayName: 'Pending',
          defaultLocale: 'en',
        });
        const enabledAt = new Date('2026-10-20T10:00:00.000Z');
        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('active-secret'),
          enrolledAt: enabledAt,
          verifiedAt: enabledAt,
          lastUsedTimeStep: 200,
          pendingEncryptedSecret: null,
        });

        await totpSecrets.savePending(userId, EncryptedString.of('first-pending'));
        await totpSecrets.savePending(userId, EncryptedString.of('second-pending'));
        const pending = await totpSecrets.findByUser(userId);
        const swappedAt = new Date('2026-10-26T10:00:00.000Z');
        const staleSwap = await totpSecrets.promotePending(
          userId,
          EncryptedString.of('first-pending'),
          150,
          swappedAt,
        );
        const swap = await totpSecrets.promotePending(
          userId,
          EncryptedString.of('second-pending'),
          150,
          swappedAt,
        );
        const repeatedSwap = await totpSecrets.promotePending(
          userId,
          EncryptedString.of('second-pending'),
          151,
          new Date(),
        );
        const swapped = await totpSecrets.findByUser(userId);

        expect(pending).toEqual({
          userId,
          encryptedSecret: 'active-secret',
          enrolledAt: enabledAt,
          verifiedAt: enabledAt,
          lastUsedTimeStep: 200,
          pendingEncryptedSecret: 'second-pending',
        });
        expect([staleSwap, swap, repeatedSwap]).toEqual([false, true, false]);
        expect(swapped).toEqual({
          userId,
          encryptedSecret: 'second-pending',
          enrolledAt: swappedAt,
          verifiedAt: swappedAt,
          lastUsedTimeStep: 150,
          pendingEncryptedSecret: null,
        });
      });
    });

    it('returns null when no TOTP secret exists', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const totpSecrets = new DrizzleTotpSecretRepository(db);
        const result = await totpSecrets.findByUser(UserId.of(makeUserId()));
        expect(result).toBeNull();
      });
    });

    it('deletes a TOTP secret', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);

        const userId = UserId.of(makeUserId());
        await users.create({
          id: userId,
          email: `totpdel-${userId}@example.com`,
          displayName: 'DelUser',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: EncryptedString.of('to-delete'),
          enrolledAt: new Date(),
          verifiedAt: null,
          lastUsedTimeStep: null,
          pendingEncryptedSecret: null,
        });

        await totpSecrets.delete(userId);

        const found = await totpSecrets.findByUser(userId);
        expect(found).toBeNull();
      });
    });
  });

  // ─── DrizzleHouseholdInviteRepository ───────────────────────────────────────

  describe('DrizzleHouseholdInviteRepository', () => {
    it('creates and finds an invite by token hash', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const invites = new DrizzleHouseholdInviteRepository(db);

        const hhId = HouseholdId.of(makeHouseholdId());
        await households.create({ id: hhId, name: 'Invite HH', baseCurrency: 'PLN' });

        const tokenHash = createHash('sha256').update('invite-token-1').digest('hex');
        const invite = await invites.replaceOpen(
          {
            id: crypto.randomUUID(),
            householdId: hhId,
            email: 'Invitee@Example.COM',
            tokenHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            invitedByUserId: null,
          },
          new Date(),
        );

        expect(invite.email).toBe('invitee@example.com');

        const found = await invites.findByTokenHash(tokenHash);
        expect(found).not.toBeNull();
        expect(found!.householdId).toBe(hhId);
      });
    });

    it('returns null for unknown token hash', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const invites = new DrizzleHouseholdInviteRepository(db);
        const result = await invites.findByTokenHash('no-such-hash');
        expect(result).toBeNull();
      });
    });

    it('accepts an invite: the user joins as member and the invite is closed', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const invites = new DrizzleHouseholdInviteRepository(db);

        const hhId = HouseholdId.of(makeHouseholdId());
        await households.create({ id: hhId, name: 'Accept HH', baseCurrency: 'EUR' });
        const user = await insertTestUser(db, { email: 'accept@example.com' });

        const tokenHash = createHash('sha256').update('accept-token').digest('hex');
        const invite = await invites.replaceOpen(
          {
            id: crypto.randomUUID(),
            householdId: hhId,
            email: 'accept@example.com',
            tokenHash,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            invitedByUserId: null,
          },
          new Date(),
        );

        const outcome = await invites.acceptAndJoin({
          inviteId: invite.id,
          householdId: hhId,
          userId: UserId.of(user.id),
          leaveHouseholdId: null,
          maxMembers: 2,
          at: new Date(),
        });

        expect(outcome).toBe('joined');
        const found = await invites.findByTokenHash(tokenHash);
        expect(found!.acceptedAt).not.toBeNull();
        expect(await households.countMembers(hhId)).toBe(1);
      });
    });
  });
});

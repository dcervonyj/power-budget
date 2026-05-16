import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../drizzle/schema.js';
import { startContainers, stopContainers, getPool } from './setup.js';
import { withRollbackTransaction, makeUserId, makeHouseholdId } from './test-helpers.js';
import { DrizzleUserRepository } from '../../auth/infrastructure/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../auth/infrastructure/DrizzleHouseholdRepository.js';
import { DrizzleMagicLinkTokenRepository } from '../../auth/infrastructure/DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from '../../auth/infrastructure/DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from '../../auth/infrastructure/DrizzleHouseholdInviteRepository.js';
import type { UserId, HouseholdId } from '@power-budget/core';

type DB = NodePgDatabase<typeof schema>;

describe('Integration: auth token infrastructure adapters', () => {
  beforeAll(async () => {
    await startContainers();
  }, 90_000);

  afterAll(async () => {
    await stopContainers();
  }, 30_000);

  // ─── DrizzleMagicLinkTokenRepository ────────────────────────────────────────

  describe('DrizzleMagicLinkTokenRepository', () => {
    it('saves and consumes a valid token', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const magicLinks = new DrizzleMagicLinkTokenRepository(db);

        const userId = makeUserId() as UserId;
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

        const userId = makeUserId() as UserId;
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
  });

  // ─── DrizzleTotpSecretRepository ────────────────────────────────────────────

  describe('DrizzleTotpSecretRepository', () => {
    it('saves and retrieves a TOTP secret', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);

        const userId = makeUserId() as UserId;
        await users.create({
          id: userId,
          email: `totp-${userId}@example.com`,
          displayName: 'TOTP User',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: 'enc-secret-abc',
          enrolledAt: new Date(),
          verifiedAt: null,
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

        const userId = makeUserId() as UserId;
        await users.create({
          id: userId,
          email: `totp2-${userId}@example.com`,
          displayName: 'TOTP2',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: 'old-secret',
          enrolledAt: new Date(),
          verifiedAt: null,
        });

        const verifiedAt = new Date();
        await totpSecrets.save({
          userId,
          encryptedSecret: 'new-secret',
          enrolledAt: new Date(),
          verifiedAt,
        });

        const found = await totpSecrets.findByUser(userId);
        expect(found!.encryptedSecret).toBe('new-secret');
        expect(found!.verifiedAt).not.toBeNull();
      });
    });

    it('returns null when no TOTP secret exists', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const totpSecrets = new DrizzleTotpSecretRepository(db);
        const result = await totpSecrets.findByUser(makeUserId() as UserId);
        expect(result).toBeNull();
      });
    });

    it('deletes a TOTP secret', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const totpSecrets = new DrizzleTotpSecretRepository(db);

        const userId = makeUserId() as UserId;
        await users.create({
          id: userId,
          email: `totpdel-${userId}@example.com`,
          displayName: 'DelUser',
          defaultLocale: 'en',
        });

        await totpSecrets.save({
          userId,
          encryptedSecret: 'to-delete',
          enrolledAt: new Date(),
          verifiedAt: null,
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

        const hhId = makeHouseholdId() as HouseholdId;
        await households.create({ id: hhId, name: 'Invite HH', baseCurrency: 'PLN' });

        const tokenHash = createHash('sha256').update('invite-token-1').digest('hex');
        const invite = await invites.create({
          id: crypto.randomUUID(),
          householdId: hhId,
          email: 'Invitee@Example.COM',
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          acceptedAt: null,
        });

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

    it('accepts an invite', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const households = new DrizzleHouseholdRepository(db);
        const invites = new DrizzleHouseholdInviteRepository(db);

        const hhId = makeHouseholdId() as HouseholdId;
        await households.create({ id: hhId, name: 'Accept HH', baseCurrency: 'EUR' });

        const tokenHash = createHash('sha256').update('accept-token').digest('hex');
        const invite = await invites.create({
          id: crypto.randomUUID(),
          householdId: hhId,
          email: 'accept@example.com',
          tokenHash,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          acceptedAt: null,
        });

        const acceptedAt = new Date();
        await invites.accept(invite.id, acceptedAt);

        const found = await invites.findByTokenHash(tokenHash);
        expect(found!.acceptedAt).not.toBeNull();
      });
    });
  });
});

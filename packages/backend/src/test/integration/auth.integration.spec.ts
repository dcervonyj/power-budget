import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../drizzle/schema.js';
import { startContainers, stopContainers, getPool } from './setup.js';
import { withRollbackTransaction, makeUserId, makeHouseholdId } from './test-helpers.js';
import { DrizzleUserRepository } from '../../auth/infrastructure/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../auth/infrastructure/DrizzleHouseholdRepository.js';
import type { UserId, HouseholdId } from '@power-budget/core';

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
        const id = makeUserId() as UserId;

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
        const id = makeUserId() as UserId;

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
        const result = await users.findById(makeUserId() as UserId);
        expect(result).toBeNull();
      });
    });

    it('updates locale preference', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const id = makeUserId() as UserId;

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
        const id = makeHouseholdId() as HouseholdId;

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
        const result = await households.findById(makeHouseholdId() as HouseholdId);
        expect(result).toBeNull();
      });
    });

    it('adds a member and finds the membership', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const households = new DrizzleHouseholdRepository(db);

        const userId = makeUserId() as UserId;
        const hhId = makeHouseholdId() as HouseholdId;

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
        const hhId = makeHouseholdId() as HouseholdId;
        const userId = makeUserId() as UserId;
        await households.create({ id: hhId, name: 'HH', baseCurrency: 'USD' });

        const result = await households.findMembership(hhId, userId);
        expect(result).toBeNull();
      });
    });

    it('findByUserId returns the household of a member', async () => {
      await withRollbackTransaction(getPool(), async (db: DB) => {
        const users = new DrizzleUserRepository(db);
        const households = new DrizzleHouseholdRepository(db);

        const userId = makeUserId() as UserId;
        const hhId = makeHouseholdId() as HouseholdId;

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
        const result = await households.findByUserId(makeUserId() as UserId);
        expect(result).toBeNull();
      });
    });
  });
});

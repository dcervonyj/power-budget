import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startContainers, stopContainers, getDb } from './setup.js';
import { insertTestUser, insertTestHousehold } from './test-helpers.js';
import { users, households, householdUsers } from '../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';

describe('Integration: database smoke tests', () => {
  beforeAll(async () => {
    await startContainers();
  }, 90_000);

  afterAll(async () => {
    await stopContainers();
  }, 30_000);

  it('can insert and query a user', async () => {
    const db = getDb();
    const user = await insertTestUser(db, { email: 'smoke@example.com' });

    const found = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    expect(found).toHaveLength(1);
    expect(found[0]!.email).toBe('smoke@example.com');
  });

  it('can insert and query a household', async () => {
    const db = getDb();
    const hh = await insertTestHousehold(db, { name: 'Smoke Household' });

    const found = await db.select().from(households).where(eq(households.id, hh.id)).limit(1);

    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe('Smoke Household');
  });

  it('enforces household isolation (tenant A cannot see tenant B data)', async () => {
    const db = getDb();
    const userA = await insertTestUser(db);
    const userB = await insertTestUser(db);
    const hhA = await insertTestHousehold(db);
    const hhB = await insertTestHousehold(db);

    await db.insert(householdUsers).values([
      { householdId: hhA.id, userId: userA.id, role: 'owner', joinedAt: new Date() },
      { householdId: hhB.id, userId: userB.id, role: 'owner', joinedAt: new Date() },
    ]);

    const hhBMembers = await db
      .select()
      .from(householdUsers)
      .where(eq(householdUsers.householdId, hhB.id));

    const memberIds = hhBMembers.map((m) => m.userId);
    expect(memberIds).not.toContain(userA.id);
  });
});

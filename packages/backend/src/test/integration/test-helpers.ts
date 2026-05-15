import { Pool, type PoolClient } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../drizzle/schema.js';

/**
 * Creates an isolated DB transaction for a test, then rolls it back.
 * Use in beforeEach/afterEach for true test isolation without truncating tables.
 */
export async function withRollbackTransaction(
  pool: Pool,
  fn: (db: NodePgDatabase<typeof schema>) => Promise<void>,
): Promise<void> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const db = drizzle(client as unknown as Pool, { schema });
    await fn(db);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

export function makeUserId(): string {
  return crypto.randomUUID();
}

export function makeHouseholdId(): string {
  return crypto.randomUUID();
}

export function makePlanId(): string {
  return crypto.randomUUID();
}

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
}

export interface TestHousehold {
  id: string;
  name: string;
  baseCurrency: string;
}

export async function insertTestUser(
  db: NodePgDatabase<typeof schema>,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const user: TestUser = {
    id: makeUserId(),
    email: `test-${Date.now()}@example.com`,
    displayName: 'Test User',
    ...overrides,
  };

  await db.insert(schema.users).values({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    defaultLocale: 'en',
    passwordHash: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return user;
}

export async function insertTestHousehold(
  db: NodePgDatabase<typeof schema>,
  overrides: Partial<TestHousehold> = {},
): Promise<TestHousehold> {
  const household: TestHousehold = {
    id: makeHouseholdId(),
    name: 'Test Household',
    baseCurrency: 'PLN',
    ...overrides,
  };

  await db.insert(schema.households).values({
    id: household.id,
    name: household.name,
    baseCurrency: household.baseCurrency,
    createdAt: new Date(),
  });

  return household;
}

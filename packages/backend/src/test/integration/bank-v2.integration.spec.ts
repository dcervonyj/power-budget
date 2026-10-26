import { randomUUID } from 'node:crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BankAccountId, BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { DrizzleBankAccountIdentityRepository } from '../../infrastructure/bank/DrizzleBankAccountIdentityRepository.js';
import { DrizzleBankFetchLedgerRepository } from '../../infrastructure/bank/DrizzleBankFetchLedgerRepository.js';
import { DrizzleSyncRunRepository } from '../../infrastructure/bank/DrizzleSyncRunRepository.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

interface Tenant {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly connectionId: BankConnectionId;
  readonly accountId: BankAccountId;
}

let fixtures: Pool;
let appPool: Pool;
let db: NodePgDatabase<typeof schema>;
let A: Tenant;
let B: Tenant;

async function seedTenant(label: string): Promise<Tenant> {
  const t: Tenant = {
    householdId: randomUUID() as HouseholdId,
    userId: randomUUID() as UserId,
    connectionId: randomUUID() as BankConnectionId,
    accountId: randomUUID() as BankAccountId,
  };
  await fixtures.query(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
    t.userId,
    `${label}-${t.userId}@example.com`,
  ]);
  await fixtures.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, $2, 'PLN')`, [
    t.householdId,
    label,
  ]);
  await fixtures.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
     VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK')`,
    [t.connectionId, t.householdId, t.userId],
  );
  await fixtures.query(
    `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
     VALUES ($1, $2, $3, $4, $5, 'Main', 'PLN')`,
    [t.accountId, t.householdId, t.userId, t.connectionId, `ext-${label}`],
  );

  return t;
}

function asTenant<T>(t: Tenant, fn: () => Promise<T>): Promise<T> {
  return runInDbScope({ kind: 'household', householdId: t.householdId, userId: t.userId }, fn);
}

describe('Integration: bank v2 repositories (BNK-003)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    db = drizzle(appPool, { schema });
  });

  beforeEach(async () => {
    await resetState();
    A = await seedTenant('alice');
    B = await seedTenant('bob');
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  it('stores and finds an account identity, unique per household', async () => {
    const repo = new DrizzleBankAccountIdentityRepository(db);
    const otherAccount = randomUUID() as BankAccountId;
    await fixtures.query(
      `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
       VALUES ($1, $2, $3, $4, 'ext-2', 'Second', 'PLN')`,
      [otherAccount, A.householdId, A.userId, A.connectionId],
    );

    await asTenant(A, () =>
      repo.setIdentity(
        A.accountId,
        { identificationHash: 'h1', providerAccountUid: 'uid' },
        A.householdId,
      ),
    );

    expect(await asTenant(A, () => repo.findByIdentificationHash('h1', A.householdId))).toBe(
      A.accountId,
    );
    await expect(
      asTenant(A, () =>
        repo.setIdentity(
          otherAccount,
          { identificationHash: 'h1', providerAccountUid: null },
          A.householdId,
        ),
      ),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    // A lookup never crosses households, and identifying an unknown account fails loudly.
    expect(await asTenant(A, () => repo.findByIdentificationHash('h1', B.householdId))).toBeNull();
    await expect(
      asTenant(A, () =>
        repo.setIdentity(
          B.accountId,
          { identificationHash: 'h9', providerAccountUid: null },
          A.householdId,
        ),
      ),
    ).rejects.toThrow(/not found/);
    // The same hash is allowed in another household, and is not visible across households.
    await asTenant(B, () =>
      repo.setIdentity(
        B.accountId,
        { identificationHash: 'h1', providerAccountUid: null },
        B.householdId,
      ),
    );
    expect(await asTenant(B, () => repo.findByIdentificationHash('h1', B.householdId))).toBe(
      B.accountId,
    );
  });

  it('persists fetched, trigger and attended on a sync run', async () => {
    const repo = new DrizzleSyncRunRepository(db);

    const id = await asTenant(A, () =>
      repo.start(A.connectionId, { trigger: 'scheduled', attended: false }),
    );
    await asTenant(A, () => repo.finish(id, { ok: true, fetched: 7 }));

    const { rows } = await fixtures.query(
      'SELECT trigger, attended, fetched, status FROM sync_runs WHERE id = $1',
      [id],
    );
    expect(rows).toEqual([
      { trigger: 'scheduled', attended: false, fetched: 7, status: 'success' },
    ]);
  });

  it('records ledger entries and refuses ones that reference another household', async () => {
    const repo = new DrizzleBankFetchLedgerRepository(db);
    const at = new Date('2026-10-26T06:30:00Z');
    const entry = {
      householdId: A.householdId,
      accountId: A.accountId,
      connectionId: A.connectionId,
      at,
      callKind: 'transactions' as const,
      attended: false,
      httpStatus: 200,
      errorCode: null,
      syncRunId: null,
    };

    await asTenant(A, () => repo.record(entry));

    expect(
      await asTenant(A, () =>
        repo.countUnattendedSince(A.accountId, 'transactions', new Date('2026-10-26T00:00:00Z')),
      ),
    ).toBe(1);
    await expect(
      asTenant(A, () => repo.record({ ...entry, accountId: B.accountId })),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    const foreignRun = await asTenant(B, () =>
      new DrizzleSyncRunRepository(db).start(B.connectionId, {
        trigger: 'manual',
        attended: false,
      }),
    );
    await expect(
      asTenant(A, () => repo.record({ ...entry, syncRunId: foreignRun })),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    await expect(
      asTenant(A, () => repo.record({ ...entry, connectionId: B.connectionId })),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { HouseholdId, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { runInDbScope } from '../../infrastructure/database/DbScope.js';
import { DrizzleHouseholdPurgeRepository } from '../../infrastructure/auth/DrizzleHouseholdPurgeRepository.js';
import { PurgeDeletedHouseholdsUseCase } from '../../application/auth/use-cases/PurgeDeletedHouseholdsUseCase.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

const DAY_MS = 86_400_000;

let fixtures: Pool;
let appPool: Pool;
let useCase: PurgeDeletedHouseholdsUseCase;

interface Seeded {
  readonly householdId: HouseholdId;
  readonly ownerId: UserId;
}

async function seedUser(label: string): Promise<UserId> {
  const id = randomUUID() as UserId;
  await fixtures.query(
    `INSERT INTO users (id, email, display_name, default_locale) VALUES ($1, $2, $3, 'en')`,
    [id, `${label}-${id}@example.com`, label],
  );
  await fixtures.query(`INSERT INTO auth_methods (id, user_id, kind) VALUES ($1, $2, 'password')`, [
    randomUUID(),
    id,
  ]);
  await fixtures.query(
    `INSERT INTO totp_secrets (user_id, encrypted_secret) VALUES ($1, 'ciphertext')`,
    [id],
  );
  await fixtures.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 day')`,
    [randomUUID(), id, `hash-${id}`],
  );

  return id;
}

async function seedHousehold(
  owner: UserId,
  members: readonly UserId[],
  scheduledAt: Date | null,
): Promise<Seeded> {
  const householdId = randomUUID() as HouseholdId;
  const connectionId = randomUUID();
  const accountId = randomUUID();
  const txId = randomUUID();
  const planId = randomUUID();
  const itemId = randomUUID();
  const txBId = randomUUID();
  const categoryId = randomUUID();
  const q = fixtures;
  await q.query(
    `INSERT INTO households (id, name, base_currency, delete_scheduled_at) VALUES ($1, 'H', 'PLN', $2)`,
    [householdId, scheduledAt],
  );
  await q.query(
    `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [householdId, owner],
  );
  for (const member of members) {
    await q.query(
      `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'member')`,
      [householdId, member],
    );
  }
  await q.query(
    `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id, status)
     VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK', 'active')`,
    [connectionId, householdId, owner],
  );
  await q.query(`INSERT INTO sync_runs (id, connection_id, status) VALUES ($1, $2, 'success')`, [
    randomUUID(),
    connectionId,
  ]);
  await q.query(
    `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
     VALUES ($1, $2, $3, $4, $5, 'Main', 'PLN')`,
    [accountId, householdId, owner, connectionId, `ext-${accountId}`],
  );
  await q.query(
    `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source)
     VALUES ($1, $2, $3, '2026-10-01', -1234, 'PLN', 'coffee', 'manual')`,
    [txId, householdId, accountId],
  );
  await q.query(
    `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
     VALUES ($1, $2, -1234, 'PLN', $3)`,
    [txId, randomUUID(), owner],
  );
  await q.query(
    `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
     VALUES ($1, $2, $3, 'Plan', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
    [planId, householdId, owner],
  );
  await q.query(
    `INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
     VALUES ($1, $2, $3, $4, 'expense', 5000, 'PLN')`,
    [itemId, planId, householdId, categoryId],
  );
  await q.query(
    `INSERT INTO planned_item_versions (id, planned_item_id, household_id, after, changed_by)
     VALUES ($1, $2, $3, '{}', $4)`,
    [randomUUID(), itemId, householdId, owner],
  );
  await q.query(
    `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, source)
     VALUES ($1, $2, $3, '2026-10-02', 1234, 'PLN', 'refund', 'manual')`,
    [txBId, householdId, accountId],
  );
  await q.query(
    `INSERT INTO transfers (id, household_id, tx_a_id, tx_b_id, marked_by) VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), householdId, txId, txBId, owner],
  );
  await q.query(`INSERT INTO categories (id, household_id, name) VALUES ($1, $2, 'Food')`, [
    categoryId,
    householdId,
  ]);
  await q.query(
    `INSERT INTO category_privacy (category_id, household_id, updated_by) VALUES ($1, $2, $3)`,
    [categoryId, householdId, owner],
  );
  await q.query(
    `INSERT INTO leftover_snapshots (id, household_id, plan_id, period_end, amount_minor, currency)
     VALUES ($1, $2, $3, '2026-10-31', 100, 'PLN')`,
    [randomUUID(), householdId, planId],
  );
  await q.query(
    `INSERT INTO household_exports (id, household_id, requested_by_user_id) VALUES ($1, $2, $3)`,
    [randomUUID(), householdId, owner],
  );
  await q.query(
    `INSERT INTO household_invites (id, household_id, email, token_hash, expires_at, invited_by_user_id)
     VALUES ($1, $2, 'x@example.com', $3, now() + interval '1 day', $4)`,
    [randomUUID(), householdId, `tok-${householdId}`, owner],
  );
  await q.query(
    `INSERT INTO notifications_outbox (id, household_id, recipient_user_id, kind, dedupe_key)
     VALUES ($1, $2, $3, 'weekly_digest', $4)`,
    [randomUUID(), householdId, owner, `k-${householdId}`],
  );
  await q.query(
    `INSERT INTO audit_log (id, household_id, actor_user_id, action, subject_type, subject_id)
     VALUES ($1, $2, $3, 'plan.created', 'plan', $4)`,
    [randomUUID(), householdId, owner, planId],
  );

  return { householdId, ownerId: owner };
}

async function count(table: string, column: string, id: string): Promise<number> {
  const { rows } = await fixtures.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
    [id],
  );

  return rows[0]!.n;
}

function purgeAt(now: Date): ReturnType<PurgeDeletedHouseholdsUseCase['execute']> {
  return runInDbScope({ kind: 'system', reason: 'test-worker' }, () => useCase.execute(now));
}

describe('Integration: household purge (CLN-022) as the least-privilege app role', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appPool = ScopedPool.create({ connectionString: containers.appDatabaseUrl, max: 1 }, null);
    useCase = new PurgeDeletedHouseholdsUseCase(
      new DrizzleHouseholdPurgeRepository(drizzle(appPool, { schema })),
    );
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await appPool?.end();
    await stopContainers();
  });

  it('purges a household past its grace period, its solo members, and keeps anonymised audit rows', async () => {
    const owner = await seedUser('owner');
    const partner = await seedUser('partner');
    const due = await seedHousehold(owner, [partner], new Date(Date.now() - DAY_MS));
    // The partner also belongs to a second household: their account must survive.
    const other = await seedHousehold(partner, [], null);
    // Rows in the surviving household that point at the deleted owner must be nulled, not block.
    const otherPlanId = randomUUID();
    await fixtures.query(
      `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
       VALUES ($1, $2, $3, 'Shared', 'household', 'monthly', '2026-11-01', '2026-11-30', 'PLN')`,
      [otherPlanId, other.householdId, owner],
    );
    await fixtures.query(
      `UPDATE household_invites SET invited_by_user_id = $1, accepted_by_user_id = $1 WHERE household_id = $2`,
      [owner, other.householdId],
    );

    const output = await purgeAt(new Date());

    expect(output.failed).toEqual([]);
    expect(output.purged).toEqual([{ householdId: due.householdId, deletedUserIds: [owner] }]);
    for (const [table, column] of [
      ['households', 'id'],
      ['household_users', 'household_id'],
      ['bank_connections', 'household_id'],
      ['bank_accounts', 'household_id'],
      ['transactions', 'household_id'],
      ['plans', 'household_id'],
      ['planned_items', 'household_id'],
      ['planned_item_versions', 'household_id'],
      ['transfers', 'household_id'],
      ['categories', 'household_id'],
      ['category_privacy', 'household_id'],
      ['leftover_snapshots', 'household_id'],
      ['household_exports', 'household_id'],
      ['household_invites', 'household_id'],
      ['notifications_outbox', 'household_id'],
    ] as const) {
      expect(await count(table, column, due.householdId), table).toBe(0);
    }
    expect(await count('users', 'id', owner)).toBe(0);
    expect(await count('totp_secrets', 'user_id', owner)).toBe(0);
    const nulled = await fixtures.query<{ plan_owner: string | null; inviter: string | null }>(
      `SELECT (SELECT owner_user_id FROM plans WHERE id = $1) AS plan_owner,
              (SELECT invited_by_user_id FROM household_invites WHERE household_id = $2) AS inviter`,
      [otherPlanId, other.householdId],
    );
    expect(nulled.rows[0]).toEqual({ plan_owner: null, inviter: null });
    expect(await count('sessions', 'user_id', owner)).toBe(0);
    expect(await count('auth_methods', 'user_id', owner)).toBe(0);
    expect(await count('users', 'id', partner)).toBe(1);
    expect(await count('sessions', 'user_id', partner)).toBe(1);
    expect(await count('households', 'id', other.householdId)).toBe(1);
    expect(await count('transactions', 'household_id', other.householdId)).toBe(2);
    const audit = await fixtures.query<{ household_id: string | null; actor: string | null }>(
      `SELECT household_id, actor_user_id AS actor FROM audit_log WHERE action = 'plan.created'
       ORDER BY household_id NULLS FIRST`,
    );
    expect(audit.rows).toEqual([
      { household_id: null, actor: null },
      { household_id: other.householdId, actor: partner },
    ]);
  });

  it('leaves households still inside the grace period and unscheduled ones alone', async () => {
    const soon = await seedHousehold(await seedUser('a'), [], new Date(Date.now() + DAY_MS));
    const kept = await seedHousehold(await seedUser('b'), [], null);

    const output = await purgeAt(new Date());

    expect(output).toEqual({ purged: [], failed: [] });
    expect(await count('households', 'id', soon.householdId)).toBe(1);
    expect(await count('households', 'id', kept.householdId)).toBe(1);
    expect(await count('transactions', 'household_id', soon.householdId)).toBe(2);
  });

  it('purges once the 30-day grace period passes, not before', async () => {
    const scheduledFor = new Date(Date.now() + 30 * DAY_MS);
    const seeded = await seedHousehold(await seedUser('c'), [], scheduledFor);

    const early = await purgeAt(new Date(scheduledFor.getTime() - 1000));
    const late = await purgeAt(new Date(scheduledFor.getTime() + 1000));

    expect(early.purged).toEqual([]);
    expect(late.purged.map((p) => p.householdId)).toEqual([seeded.householdId]);
    expect(await count('households', 'id', seeded.householdId)).toBe(0);
  });
});

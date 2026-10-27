import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { randomUUID } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { HouseholdId, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import { ScopedPool } from '../../infrastructure/database/ScopedPool.js';
import { runInDbScope, type DbScope } from '../../infrastructure/database/DbScope.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

interface Tenant {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly planId: string;
}

interface Observed {
  readonly householdId: string;
  readonly userId: string;
  readonly rlsBypass: string;
  readonly plans: number;
  readonly pid: number;
}

/** A pool whose clients record every statement they send, in order. */
interface RecordedPool {
  readonly pool: Pool;
  statements(): string[];
}

const OBSERVE_SQL =
  "SELECT current_setting('app.household_id', true) AS household_id, " +
  "current_setting('app.user_id', true) AS user_id, " +
  "current_setting('app.rls_bypass', true) AS rls_bypass, " +
  '(SELECT count(*)::int FROM plans) AS plans, pg_backend_pid() AS pid';

let fixtures: Pool;
let appDatabaseUrl: string;
let A: Tenant;
let B: Tenant;
const opened: Pool[] = [];

function householdScope(t: Tenant): DbScope {
  return { kind: 'household', householdId: t.householdId, userId: t.userId };
}

function statementText(statement: unknown): string {
  if (typeof statement === 'string') {
    return statement;
  }
  if (typeof statement === 'object' && statement !== null && 'text' in statement) {
    return String(statement.text);
  }

  return '';
}

function recordedPool(max: number): RecordedPool {
  const pool = ScopedPool.create({ connectionString: appDatabaseUrl, max }, null);
  const spies: MockInstance[] = [];
  pool.on('connect', (client: PoolClient) => {
    spies.push(vi.spyOn(client, 'query'));
  });
  opened.push(pool);

  return {
    pool,
    statements: () => spies.flatMap((spy) => spy.mock.calls.map((call) => statementText(call[0]))),
  };
}

async function observe(pool: Pool, scope: DbScope | null): Promise<Observed> {
  const run = (): Promise<QueryResult> => pool.query(OBSERVE_SQL);
  const { rows } = scope === null ? await run() : await runInDbScope(scope, run);
  const row = rows[0];

  return {
    householdId: row.household_id,
    userId: row.user_id,
    rlsBypass: row.rls_bypass,
    plans: row.plans,
    pid: row.pid,
  };
}

async function seedTenant(label: string): Promise<Tenant> {
  const t: Tenant = {
    householdId: HouseholdId.of(uuidv7()),
    userId: UserId.of(uuidv7()),
    planId: randomUUID(),
  };
  await fixtures.query(
    `INSERT INTO users (id, email, display_name, default_locale) VALUES ($1, $2, $3, 'en')`,
    [t.userId, `${label}-${t.userId}@example.com`, label],
  );
  await fixtures.query(`INSERT INTO households (id, name, base_currency) VALUES ($1, $2, 'PLN')`, [
    t.householdId,
    label,
  ]);
  await fixtures.query(
    `INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [t.householdId, t.userId],
  );
  await fixtures.query(
    `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
     VALUES ($1, $2, $3, 'Plan', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
    [t.planId, t.householdId, t.userId],
  );

  return t;
}

describe('Integration: ScopedPool keeps the DbScope on the pooled connection (CLN-052)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    fixtures = getPool();
    appDatabaseUrl = containers.appDatabaseUrl;
  });

  beforeEach(async () => {
    await resetState();
    A = await seedTenant('alice');
    B = await seedTenant('bob');
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((pool) => pool.end()));
  });

  afterAll(async () => {
    await stopContainers();
  });

  it('sets the scope once per checkout and runs single statements without BEGIN/COMMIT', async () => {
    const { pool, statements } = recordedPool(1);

    const first = await runInDbScope(householdScope(A), () => pool.query('SELECT id FROM plans'));
    const second = await runInDbScope(householdScope(A), () => pool.query('SELECT id FROM plans'));

    expect(first.rows).toEqual([{ id: A.planId }]);
    expect(second.rows).toEqual([{ id: A.planId }]);
    expect(statements()).toEqual([
      ScopedPool.settingsSql(householdScope(A)),
      'SELECT id FROM plans',
      'SELECT id FROM plans',
    ]);
  });

  it('applies the settings again only when a checkout has another scope', async () => {
    const { pool, statements } = recordedPool(1);
    const system: DbScope = { kind: 'system', reason: 'test' };

    const seen = [
      await observe(pool, householdScope(A)),
      await observe(pool, householdScope(B)),
      await observe(pool, householdScope(B)),
      await observe(pool, null),
      await observe(pool, system),
      await observe(pool, householdScope(A)),
    ];

    expect(seen.map((o) => [o.householdId, o.rlsBypass, o.plans])).toEqual([
      [A.householdId, 'off', 1],
      [B.householdId, 'off', 1],
      [B.householdId, 'off', 1],
      ['', 'off', 0],
      ['', 'on', 2],
      [A.householdId, 'off', 1],
    ]);
    expect(new Set(seen.map((o) => o.pid)).size).toBe(1);
    expect(statements().filter((s) => s.includes('set_config'))).toHaveLength(5);
  });

  it('never serves one scope the settings of another on a reused connection', async () => {
    const { pool } = recordedPool(2);
    const userOnly: DbScope = { kind: 'user', userId: A.userId };
    const system: DbScope = { kind: 'system', reason: 'test' };
    const cases: { scope: DbScope | null; expected: Omit<Observed, 'pid'> }[] = [
      {
        scope: householdScope(A),
        expected: { householdId: A.householdId, userId: A.userId, rlsBypass: 'off', plans: 1 },
      },
      {
        scope: householdScope(B),
        expected: { householdId: B.householdId, userId: B.userId, rlsBypass: 'off', plans: 1 },
      },
      {
        scope: userOnly,
        expected: { householdId: '', userId: A.userId, rlsBypass: 'off', plans: 0 },
      },
      { scope: system, expected: { householdId: '', userId: '', rlsBypass: 'on', plans: 2 } },
      { scope: null, expected: { householdId: '', userId: '', rlsBypass: 'off', plans: 0 } },
    ];
    const rounds = Array.from({ length: 12 }, (_, i) => cases[(i * 7) % cases.length]!).concat(
      Array.from({ length: 12 }, (_, i) => cases[i % cases.length]!),
    );

    const seen = await Promise.all(rounds.map((c) => observe(pool, c.scope)));

    seen.forEach((o, i) => {
      expect(o, `round ${i}`).toEqual({ ...rounds[i]!.expected, pid: o.pid });
    });
    expect(new Set(seen.map((o) => o.pid)).size).toBeLessThanOrEqual(2);
  });

  it('runs a drizzle transaction under the scope of its checkout, with no settings inside it', async () => {
    const { pool, statements } = recordedPool(1);
    const db = drizzle(pool, { schema });

    await runInDbScope(householdScope(A), () => pool.query('SELECT id FROM plans'));
    const ids = await runInDbScope(householdScope(B), () =>
      db.transaction((tx) => tx.select({ id: schema.plans.id }).from(schema.plans)),
    );

    expect(ids).toEqual([{ id: B.planId }]);
    const sent = statements();
    expect(sent.filter((s) => s.includes('set_config'))).toEqual([
      ScopedPool.settingsSql(householdScope(A)),
      ScopedPool.settingsSql(householdScope(B)),
    ]);
    expect(sent.indexOf(ScopedPool.settingsSql(householdScope(B)))).toBeLessThan(
      sent.findIndex((s) => /^\s*begin/i.test(s)),
    );
  });

  it('keeps the connection and its scope after a statement the database rejects', async () => {
    const { pool, statements } = recordedPool(1);
    const before = await observe(pool, householdScope(A));

    await expect(
      runInDbScope(householdScope(A), () =>
        pool.query(
          `INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
           VALUES ($1, $2, $3, 'Forged', 'household', 'monthly', '2026-10-01', '2026-10-31', 'PLN')`,
          [randomUUID(), B.householdId, B.userId],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    const after = await observe(pool, householdScope(A));

    expect(after).toEqual(before);
    expect(statements().filter((s) => s.includes('set_config'))).toHaveLength(1);
  });

  it('scopes the callback forms of query and connect too', async () => {
    const { pool } = recordedPool(1);
    await observe(pool, householdScope(B));

    const viaQuery = await runInDbScope(
      householdScope(A),
      () =>
        new Promise<unknown[]>((resolve, reject) => {
          pool.query('SELECT id FROM plans', (error: Error | undefined, result: QueryResult) => {
            if (error) {
              reject(error);

              return;
            }
            resolve(result.rows);
          });
        }),
    );
    const viaConnect = await runInDbScope(
      householdScope(A),
      () =>
        new Promise<unknown[]>((resolve, reject) => {
          pool.connect((error, client, done) => {
            if (error || !client) {
              reject(error);

              return;
            }
            client.query('SELECT id FROM plans').then((result) => {
              done();
              resolve(result.rows);
            }, reject);
          });
        }),
    );

    expect(viaQuery).toEqual([{ id: A.planId }]);
    expect(viaConnect).toEqual([{ id: A.planId }]);
  });
});

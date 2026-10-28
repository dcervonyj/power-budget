import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyRoles } from '../../../drizzle/roles.mjs';
import { startContainers, stopContainers } from './setup.js';

const MIGRATIONS = path.resolve(process.cwd(), 'drizzle/migrations');
const SUFFIX = Math.random().toString(36).slice(2, 8);
const OWNER = `pb_owner_${SUFFIX}`;
const OWNER_PASSWORD = 'owner-pw';
const APP = `pb_app_${SUFFIX}`;
const APP_PASSWORD = 'app-pw';

interface Journal {
  entries: { idx: number; tag: string; when: number }[];
}

let admin: Pool;
let adminUrl: string;
const pools: Pool[] = [];

function urlFor(user: string, password: string, database: string): string {
  const url = new URL(adminUrl);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;

  return url.toString();
}

function track(pool: Pool): Pool {
  pools.push(pool);

  return pool;
}

async function createDatabase(name: string): Promise<Pool> {
  await admin.query(`CREATE DATABASE "${name}" OWNER "${OWNER}"`);

  return track(new Pool({ connectionString: urlFor(OWNER, OWNER_PASSWORD, name) }));
}

/** A migrations folder whose journal stops after journal idx `lastIdx`. */
function folderUpTo(lastIdx: number): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pb-migrations-'));
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  journal.entries = journal.entries.filter((e) => e.idx <= lastIdx);
  writeFileSync(journalPath, JSON.stringify(journal));

  return dir;
}

function fullJournal(): Journal {
  return JSON.parse(readFileSync(path.join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as Journal;
}

async function applied(pool: Pool): Promise<number[]> {
  const { rows } = await pool.query<{ created_at: string }>(
    'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at',
  );

  return rows.map((r) => Number(r.created_at));
}

async function expectFullSchema(pool: Pool): Promise<void> {
  const tables = await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('sync_runs','household_exports','users')",
  );
  expect(tables.rows[0]!.n).toBe(3);
  const column = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_bouncing'",
  );
  expect(column.rowCount).toBe(1);
  // CLN-012 dropped the never-refreshed plan actuals view and its refresh function.
  const view = await pool.query("SELECT 1 FROM pg_matviews WHERE matviewname = 'v_plan_actuals'");
  expect(view.rowCount).toBe(0);
  const fn = await pool.query("SELECT 1 FROM pg_proc WHERE proname = 'refresh_plan_actuals'");
  expect(fn.rowCount).toBe(0);
}

describe('Integration: drizzle migrations and DB roles (CLN-018)', () => {
  beforeAll(async () => {
    const containers = await startContainers();
    adminUrl = containers.databaseUrl;
    admin = track(new Pool({ connectionString: adminUrl }));
    await admin.query(
      `CREATE ROLE "${OWNER}" LOGIN PASSWORD '${OWNER_PASSWORD}' CREATEROLE NOSUPERUSER`,
    );
  }, 120_000);

  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
    await stopContainers();
  }, 30_000);

  it('applies every journal entry from an empty database', async () => {
    const pool = await createDatabase(`empty_${SUFFIX}`);

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    expect(await applied(pool)).toEqual(fullJournal().entries.map((e) => e.when));
    await expectFullSchema(pool);
  });

  it('has the indexes the queries need and no duplicates (CLN-049)', async () => {
    const pool = await createDatabase(`indexes_${SUFFIX}`);

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    const { rows } = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('transfers','audit_log','sessions','household_invites','transactions')",
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining(['transfers_household_idx', 'audit_log_household_id_idx']),
    );
    for (const dropped of [
      'sessions_token_hash_idx',
      'household_invites_token_idx',
      'transfers_tx_a_idx',
      'transfers_tx_b_idx',
      'transactions_household_date_idx',
    ]) {
      expect(names).not.toContain(dropped);
    }
    // The unique twins and the keyset index keep serving the dropped duplicates' queries.
    expect(names).toEqual(
      expect.arrayContaining([
        'sessions_token_hash_unique',
        'household_invites_token_unique',
        'transfers_tx_a_unique',
        'transfers_tx_b_unique',
        'transactions_household_date_id_idx',
      ]),
    );
  });

  it.each([
    [2, 'fresh 0002 baseline'],
    [5, 'journal idx 5 (before 0005_be-029_email_bouncing)'],
    [6, 'journal idx 6 (the live Neon state before CLN-018)'],
  ])(
    'upgrades a database sitting at %i (%s) without re-running applied migrations',
    async (idx) => {
      const pool = await createDatabase(`from_${idx}_${SUFFIX}`);
      await migrate(drizzle(pool), { migrationsFolder: folderUpTo(idx) });
      const before = await applied(pool);
      expect(before).toHaveLength(idx + 1);
      // Data written before the upgrade must survive: a re-run of an applied
      // migration (or a drop/recreate) would break or wipe it.
      await pool.query("INSERT INTO currencies (code, exponent, symbol) VALUES ('XTS', 2, 'T')");

      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

      const after = await applied(pool);
      expect(after.slice(0, before.length)).toEqual(before);
      expect(after).toEqual(fullJournal().entries.map((e) => e.when));
      const sentinel = await pool.query("SELECT 1 FROM currencies WHERE code = 'XTS'");
      expect(sentinel.rowCount).toBe(1);
      await expectFullSchema(pool);

      // Idempotent: a second run is a no-op.
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
      expect(await applied(pool)).toEqual(after);
    },
  );

  it('0014 backfills account owners from the connection under FORCE RLS (CLN-023)', async () => {
    const pool = await createDatabase(`cln023_${SUFFIX}`);
    const before = fullJournal().entries.find((e) => e.tag.startsWith('0014_'))!.idx - 1;
    await migrate(drizzle(pool), { migrationsFolder: folderUpTo(before) });
    const ids = {
      user: '01900000-0000-7000-8000-000000000101',
      household: '01900000-0000-7000-8000-000000000102',
      connection: '01900000-0000-7000-8000-000000000103',
      account: '01900000-0000-7000-8000-000000000104',
      tx: '01900000-0000-7000-8000-000000000105',
    };
    const client = await pool.connect();
    try {
      // The owner is bound by FORCE RLS too: seed as system code would.
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
      await client.query(`INSERT INTO users (id, email) VALUES ($1, 'm@example.com')`, [ids.user]);
      await client.query(
        `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
        [ids.household],
      );
      await client.query(
        `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
         VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK')`,
        [ids.connection, ids.household, ids.user],
      );
      await client.query(
        `INSERT INTO bank_accounts (id, household_id, connection_id, external_id, name, currency)
         VALUES ($1, $2, $3, 'ext', 'Main', 'PLN')`,
        [ids.account, ids.household, ids.connection],
      );
      await client.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency)
         VALUES ($1, $2, $3, '2026-10-01', -100, 'PLN')`,
        [ids.tx, ids.household, ids.account],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    const verify = await pool.connect();
    try {
      await verify.query('BEGIN');
      await verify.query("SELECT set_config('app.rls_bypass', 'on', true)");
      const account = await verify.query<{ owner_user_id: string; kind: string }>(
        'SELECT owner_user_id, kind FROM bank_accounts WHERE id = $1',
        [ids.account],
      );
      const tx = await verify.query<{ status: string }>(
        'SELECT status FROM transactions WHERE id = $1',
        [ids.tx],
      );
      await verify.query('COMMIT');
      expect(account.rows).toEqual([{ owner_user_id: ids.user, kind: 'bank' }]);
      // 0014 wrote 'posted'; 0017 (SYNC-001) renamed the booked state to 'booked'.
      expect(tx.rows).toEqual([{ status: 'booked' }]);
    } finally {
      verify.release();
    }
  });

  it('0016 enforces identification_hash uniqueness per household (BNK-003)', async () => {
    const pool = await createDatabase(`bnk003_${SUFFIX}`);
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });
    const ids = {
      user: '01900000-0000-7000-8000-000000000201',
      household: '01900000-0000-7000-8000-000000000202',
      otherHousehold: '01900000-0000-7000-8000-000000000203',
    };
    const client = await pool.connect();
    const insertAccount = async (
      id: string,
      household: string,
      hash: string | null,
    ): Promise<void> => {
      await client.query(
        `INSERT INTO bank_accounts (id, household_id, owner_user_id, kind, name, currency, identification_hash)
         VALUES ($1, $2, $3, 'manual', 'A', 'PLN', $4)`,
        [id, household, ids.user, hash],
      );
    };
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
      await client.query(`INSERT INTO users (id, email) VALUES ($1, 'u@example.com')`, [ids.user]);
      for (const household of [ids.household, ids.otherHousehold]) {
        await client.query(
          `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
          [household],
        );
      }
      await insertAccount('01900000-0000-7000-8000-000000000211', ids.household, 'hash-1');
      // The same hash in another household, and accounts without a hash, are allowed.
      await insertAccount('01900000-0000-7000-8000-000000000212', ids.otherHousehold, 'hash-1');
      await insertAccount('01900000-0000-7000-8000-000000000213', ids.household, null);
      await insertAccount('01900000-0000-7000-8000-000000000214', ids.household, null);
      await client.query('SAVEPOINT dup');
      await expect(
        insertAccount('01900000-0000-7000-8000-000000000215', ids.household, 'hash-1'),
      ).rejects.toMatchObject({ code: '23505' });
      await client.query('ROLLBACK TO SAVEPOINT dup');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('0017 backfills transaction status, direction and source kind under FORCE RLS (SYNC-001)', async () => {
    const pool = await createDatabase(`sync001_${SUFFIX}`);
    const before = fullJournal().entries.find((e) => e.tag.startsWith('0017_'))!.idx - 1;
    await migrate(drizzle(pool), { migrationsFolder: folderUpTo(before) });
    const ids = {
      user: '01900000-0000-7000-8000-000000000301',
      household: '01900000-0000-7000-8000-000000000302',
      connection: '01900000-0000-7000-8000-000000000303',
      account: '01900000-0000-7000-8000-000000000304',
      cash: '01900000-0000-7000-8000-000000000305',
      posted: '01900000-0000-7000-8000-000000000311',
      pending: '01900000-0000-7000-8000-000000000312',
      cancelled: '01900000-0000-7000-8000-000000000313',
      manual: '01900000-0000-7000-8000-000000000314',
    };
    const client = await pool.connect();
    const insertTx = async (
      id: string,
      account: string,
      amount: number,
      source: string,
      status: string,
    ): Promise<void> => {
      await client.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, source, status)
         VALUES ($1, $2, $3, '2026-10-01', $4, 'PLN', $5, $6)`,
        [id, ids.household, account, amount, source, status],
      );
    };
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
      await client.query(`INSERT INTO users (id, email) VALUES ($1, 's@example.com')`, [ids.user]);
      await client.query(
        `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
        [ids.household],
      );
      await client.query(
        `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
         VALUES ($1, $2, $3, 'gocardless', 'TEST_BANK')`,
        [ids.connection, ids.household, ids.user],
      );
      await client.query(
        `INSERT INTO bank_accounts (id, household_id, owner_user_id, connection_id, external_id, name, currency)
         VALUES ($1, $2, $3, $4, 'ext', 'Main', 'PLN')`,
        [ids.account, ids.household, ids.user, ids.connection],
      );
      await client.query(
        `INSERT INTO bank_accounts (id, household_id, owner_user_id, kind, name, currency)
         VALUES ($1, $2, $3, 'manual', 'Cash', 'PLN')`,
        [ids.cash, ids.household, ids.user],
      );
      await insertTx(ids.posted, ids.account, -100, 'bank_sync', 'posted');
      await insertTx(ids.pending, ids.account, 250, 'bank_sync', 'pending');
      await insertTx(ids.cancelled, ids.account, -300, 'bank_sync', 'cancelled');
      await insertTx(ids.manual, ids.cash, -400, 'manual', 'posted');
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    const verify = await pool.connect();
    try {
      await verify.query('BEGIN');
      await verify.query("SELECT set_config('app.rls_bypass', 'on', true)");
      const { rows } = await verify.query(
        `SELECT id, status, direction, source_kind, auto_mapped FROM transactions ORDER BY id`,
      );
      expect(rows).toEqual([
        {
          id: ids.posted,
          status: 'booked',
          direction: 'debit',
          source_kind: null,
          auto_mapped: false,
        },
        {
          id: ids.pending,
          status: 'pending',
          direction: 'credit',
          source_kind: null,
          auto_mapped: false,
        },
        {
          id: ids.cancelled,
          status: 'cancelled',
          direction: 'debit',
          source_kind: null,
          auto_mapped: false,
        },
        {
          id: ids.manual,
          status: 'manual',
          direction: 'debit',
          source_kind: 'manual',
          auto_mapped: false,
        },
      ]);
      // The retired value is refused, and a new row defaults to booked.
      await verify.query('SAVEPOINT retired');
      await expect(
        insertStatus(verify, '01900000-0000-7000-8000-000000000398', "'posted'"),
      ).rejects.toMatchObject({ code: '23514' });
      await verify.query('ROLLBACK TO SAVEPOINT retired');
      await insertStatus(verify, '01900000-0000-7000-8000-000000000399', 'DEFAULT');
      const fresh = await verify.query(
        `SELECT status FROM transactions WHERE id = '01900000-0000-7000-8000-000000000399'`,
      );
      expect(fresh.rows).toEqual([{ status: 'booked' }]);
      await verify.query('ROLLBACK');
    } finally {
      verify.release();
    }

    async function insertStatus(db: PoolClient, id: string, status: string): Promise<void> {
      await db.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, status)
         VALUES ($1, $2, $3, '2026-10-02', 1, 'PLN', ${status})`,
        [id, ids.household, ids.account],
      );
    }
  });

  it('0020 backfills transaction_mappings.household_id and reads the RLS settings once per statement (CLN-051)', async () => {
    const pool = await createDatabase(`cln051_${SUFFIX}`);
    const before = fullJournal().entries.find((e) => e.tag.startsWith('0020_'))!.idx - 1;
    await migrate(drizzle(pool), { migrationsFolder: folderUpTo(before) });
    const ids = {
      user: '01900000-0000-7000-8000-000000000501',
      householdA: '01900000-0000-7000-8000-000000000502',
      householdB: '01900000-0000-7000-8000-000000000503',
      accountA: '01900000-0000-7000-8000-000000000504',
      accountB: '01900000-0000-7000-8000-000000000505',
      txA: '01900000-0000-7000-8000-000000000511',
      txB: '01900000-0000-7000-8000-000000000512',
      txUnmapped: '01900000-0000-7000-8000-000000000513',
      item: '01900000-0000-7000-8000-000000000521',
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
      await client.query(`INSERT INTO users (id, email) VALUES ($1, 'm@example.com')`, [ids.user]);
      for (const [household, account, tx] of [
        [ids.householdA, ids.accountA, ids.txA],
        [ids.householdB, ids.accountB, ids.txB],
      ] as const) {
        await client.query(
          `INSERT INTO households (id, name, base_currency) VALUES ($1, 'h', 'PLN')`,
          [household],
        );
        await client.query(
          `INSERT INTO bank_accounts (id, household_id, owner_user_id, kind, name, currency)
           VALUES ($1, $2, $3, 'manual', 'Cash', 'PLN')`,
          [account, household, ids.user],
        );
        await client.query(
          `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, source)
           VALUES ($1, $2, $3, '2026-10-01', -100, 'PLN', 'manual')`,
          [tx, household, account],
        );
        await client.query(
          `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
           VALUES ($1, $2, -100, 'PLN', $3)`,
          [tx, ids.item, ids.user],
        );
      }
      await client.query(
        `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, source)
         VALUES ($1, $2, $3, '2026-10-02', -100, 'PLN', 'manual')`,
        [ids.txUnmapped, ids.householdA, ids.accountA],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    const verify = await pool.connect();
    try {
      await verify.query('BEGIN');
      await verify.query("SELECT set_config('app.rls_bypass', 'on', true)");
      const backfilled = await verify.query(
        'SELECT transaction_id, household_id FROM transaction_mappings ORDER BY transaction_id',
      );
      expect(backfilled.rows).toEqual([
        { transaction_id: ids.txA, household_id: ids.householdA },
        { transaction_id: ids.txB, household_id: ids.householdB },
      ]);
      // A mapping cannot name another household than its transaction's, even with the bypass.
      await verify.query('SAVEPOINT mismatch');
      await expect(
        verify.query(
          `INSERT INTO transaction_mappings (transaction_id, household_id, planned_item_id, amount_minor, currency, mapped_by)
           VALUES ($1, $2, $3, -100, 'PLN', $4)`,
          [ids.txUnmapped, ids.householdB, ids.item, ids.user],
        ),
      ).rejects.toMatchObject({ code: '23503' });
      await verify.query('ROLLBACK TO SAVEPOINT mismatch');
      await verify.query('SAVEPOINT missing');
      await expect(
        verify.query(
          `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
           VALUES ($1, $2, -100, 'PLN', $3)`,
          [ids.txUnmapped, ids.item, ids.user],
        ),
      ).rejects.toMatchObject({ code: '23502' });
      await verify.query('ROLLBACK TO SAVEPOINT missing');

      // The owner is bound by FORCE RLS: household A sees only its own mapping.
      await verify.query(
        "SELECT set_config('app.rls_bypass', '', true), set_config('app.household_id', $1, true)",
        [ids.householdA],
      );
      const seen = await verify.query('SELECT transaction_id FROM transaction_mappings');
      expect(seen.rows).toEqual([{ transaction_id: ids.txA }]);

      // Same policies (name, command, roles); the settings are InitPlans, and the mapping
      // policy no longer looks up transactions per row.
      const policies = await verify.query<{
        tablename: string;
        policyname: string;
        cmd: string;
        roles: string[];
        qual: string;
        with_check: string;
      }>(
        `SELECT tablename, policyname, cmd, roles::text[] AS roles, qual, with_check FROM pg_policies
          WHERE tablename IN ('transactions', 'transaction_mappings') ORDER BY tablename`,
      );
      expect(policies.rows.map((p) => [p.tablename, p.policyname, p.cmd, p.roles])).toEqual([
        ['transaction_mappings', 'tenant_isolation', 'ALL', ['public']],
        ['transactions', 'tenant_isolation', 'ALL', ['public']],
      ]);
      for (const p of policies.rows) {
        expect(p.qual).toBe(
          '(( SELECT app_rls_bypass() AS app_rls_bypass) OR (household_id = ( SELECT app_current_household_id() AS app_current_household_id)))',
        );
        expect(p.with_check).toContain('( SELECT app_rls_bypass() AS app_rls_bypass)');
        expect(p.with_check).toContain(
          '(household_id = ( SELECT app_current_household_id() AS app_current_household_id))',
        );
      }
      const plan = await verify.query<{ 'QUERY PLAN': string }>(
        'EXPLAIN SELECT * FROM transaction_mappings',
      );
      const text = plan.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(text).toContain('InitPlan');
      expect(text).not.toContain('SubPlan');
      expect(text).not.toContain('transactions');
      await verify.query('ROLLBACK');
    } finally {
      verify.release();
    }
  });

  it('enables and forces row level security on every tenant data table (CLN-005)', async () => {
    const pool = await createDatabase(`rls_${SUFFIX}`);
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS });

    const { rows } = await pool.query<{ relname: string; enabled: boolean; forced: boolean }>(
      `SELECT relname, relrowsecurity AS enabled, relforcerowsecurity AS forced
         FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity
        ORDER BY relname`,
    );

    expect(rows.map((r) => r.relname)).toEqual([
      'audit_log',
      'bank_accounts',
      'bank_connections',
      'bank_fetch_ledger',
      'categories',
      'category_privacy',
      'household_exports',
      'leftover_snapshots',
      'live_signals',
      'merchant_rules',
      'planned_item_versions',
      'planned_items',
      'plans',
      'sync_runs',
      'transaction_mappings',
      'transactions',
      'transfers',
    ]);
    expect(rows.every((r) => r.enabled && r.forced)).toBe(true);
  });

  describe('least-privilege app role', () => {
    let owner: Pool;
    let app: Pool;

    beforeAll(async () => {
      owner = await createDatabase(`roles_${SUFFIX}`);
      await migrate(drizzle(owner), { migrationsFolder: MIGRATIONS });
      await applyRoles(owner, { appUser: APP, appPassword: APP_PASSWORD });
      app = track(new Pool({ connectionString: urlFor(APP, APP_PASSWORD, `roles_${SUFFIX}`) }));
    });

    it('is not a superuser and owns nothing', async () => {
      const role = await owner.query(
        'SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = $1',
        [APP],
      );
      expect(role.rows[0]).toEqual({
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolbypassrls: false,
      });
      const owned = await owner.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = $1",
        [APP],
      );
      expect(owned.rowCount).toBe(0);
    });

    it('can read and write data', async () => {
      await app.query("INSERT INTO currencies (code, exponent, symbol) VALUES ('APP', 2, 'A')");
      await app.query("UPDATE currencies SET symbol = 'B' WHERE code = 'APP'");
      const read = await app.query("SELECT symbol FROM currencies WHERE code = 'APP'");
      expect(read.rows[0].symbol).toBe('B');
      await app.query("DELETE FROM currencies WHERE code = 'APP'");
    });

    it.each([
      ['CREATE TABLE', 'CREATE TABLE app_made (id int)'],
      ['ALTER TABLE', 'ALTER TABLE users ADD COLUMN app_made int'],
      ['DROP TABLE', 'DROP TABLE currencies'],
      ['TRUNCATE', 'TRUNCATE users CASCADE'],
      ['CREATE INDEX', 'CREATE INDEX app_made_idx ON currencies (symbol)'],
      ['DISABLE RLS', 'ALTER TABLE users DISABLE ROW LEVEL SECURITY'],
      ['write to drizzle bookkeeping', 'DELETE FROM drizzle.__drizzle_migrations'],
    ])('cannot run DDL: %s', async (_name, statement) => {
      await expect(app.query(statement)).rejects.toMatchObject({ code: '42501' });
    });

    it('covers tables created by later migrations through default privileges', async () => {
      await owner.query('CREATE TABLE later_table (id int PRIMARY KEY)');

      await expect(app.query('INSERT INTO later_table VALUES (1)')).resolves.toBeDefined();
    });

    it('grants the app role DML on live_signals (SYNC-001)', async () => {
      const { rows } = await owner.query(
        `SELECT privilege_type FROM information_schema.role_table_grants
          WHERE grantee = $1 AND table_name = 'live_signals' ORDER BY privilege_type`,
        [APP],
      );

      expect(rows.map((r) => r.privilege_type)).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
    });

    it('makes audit_log append-only for the app role', async () => {
      await expect(app.query("UPDATE audit_log SET action = 'x'")).rejects.toMatchObject({
        code: '42501',
      });
      await expect(app.query('DELETE FROM audit_log')).rejects.toMatchObject({ code: '42501' });
    });

    it('is idempotent', async () => {
      await expect(
        applyRoles(owner, { appUser: APP, appPassword: APP_PASSWORD }),
      ).resolves.toBeUndefined();
    });

    it('refuses to make the owner the app role', async () => {
      await expect(applyRoles(owner, { appUser: OWNER, appPassword: 'x' })).rejects.toThrow(
        /must differ/,
      );
    });
  });
});

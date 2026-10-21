import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
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
      'categories',
      'category_privacy',
      'household_exports',
      'leftover_snapshots',
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

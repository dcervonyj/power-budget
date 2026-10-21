// Idempotent database role bootstrap (CLN-018).
//
//   owner/migrator role  (MIGRATION_DATABASE_URL): owns every table, runs DDL.
//   app role             (DATABASE_URL):           DML only, no ownership, no DDL.
//
// Run as the owner/migrator role after the migrations (`pnpm db:roles`).
// Re-running is safe; it also refreshes the grants on existing tables.
// Row level security is enabled by migration 0008_rls_tenancy (CLN-005); the app role is
// NOBYPASSRLS and owns nothing, so the policies bind it. audit_log is append-only for it.
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const IDENT = /^[a-z_][a-z0-9_]*$/;

/**
 * @param {pg.Pool | pg.Client} db connected as the owner/migrator role
 * @param {{ appUser: string, appPassword: string }} options
 */
export async function applyRoles(db, { appUser, appPassword }) {
  if (!IDENT.test(appUser)) {
    throw new Error(`Invalid app role name "${appUser}" (lowercase letters, digits, _ only)`);
  }
  if (!appPassword) {
    throw new Error('APP_DB_PASSWORD is required');
  }
  const role = pg.escapeIdentifier(appUser);
  const password = pg.escapeLiteral(appPassword);
  const { rows } = await db.query(
    'SELECT current_user AS owner, current_database() AS dbname, EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS role_exists',
    [appUser],
  );
  const { owner, dbname, role_exists: exists } = rows[0];
  if (owner === appUser) {
    throw new Error('The app role must differ from the migrator/owner role');
  }
  const ownerId = pg.escapeIdentifier(owner);
  const database = pg.escapeIdentifier(dbname);

  const statements = [
    exists
      ? `ALTER ROLE ${role} WITH LOGIN PASSWORD ${password}`
      : `CREATE ROLE ${role} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
    `REVOKE ALL ON DATABASE ${database} FROM PUBLIC`,
    `GRANT CONNECT ON DATABASE ${database} TO ${role}, ${ownerId}`,
    `REVOKE CREATE ON SCHEMA public FROM PUBLIC`,
    `REVOKE CREATE ON SCHEMA public FROM ${role}`,
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    // Tables created by later migrations (run by the owner) are readable/writable without a re-run.
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerId} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerId} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    // audit_log is append-only for the app (CLN-005, audit M17).
    `REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM ${role}`,
    // The drizzle bookkeeping schema is owner-only.
    `REVOKE ALL ON SCHEMA drizzle FROM ${role}`,
  ];
  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (error) {
      // `drizzle` schema does not exist before the first migration: nothing to revoke.
      if (statement.includes('SCHEMA drizzle') && error.code === '3F000') {
        continue;
      }
      // Neither does audit_log.
      if (statement.includes('audit_log') && error.code === '42P01') {
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const url = process.env['MIGRATION_DATABASE_URL'];
  if (!url) {
    throw new Error('MIGRATION_DATABASE_URL is required (owner/migrator role)');
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    await applyRoles(pool, {
      appUser: process.env['APP_DB_USER'] ?? 'power_budget_app',
      appPassword: process.env['APP_DB_PASSWORD'] ?? '',
    });
    console.log('Roles applied');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

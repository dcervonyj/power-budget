import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'node:path';
import { APP_ROLE, appRoleUrl } from './app-role.js';
import { applyRoles } from '../../../drizzle/roles.mjs';

/**
 * Vitest globalSetup: starts ONE Postgres 16 + Redis 7 pair for the whole
 * integration run, applies the real drizzle migrations (journal-driven) and
 * exposes the connection strings to the worker processes through env vars.
 * setup.ts picks them up, so spec files never start their own containers.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16.4-alpine').start(),
    new RedisContainer('redis:7.4-alpine').start(),
  ]);

  const pool = new Pool({ connectionString: pg.getConnectionUri() });
  await migrate(drizzle(pool), {
    migrationsFolder: path.resolve(process.cwd(), 'drizzle/migrations'),
  });
  // The app runs as a least-privilege, non-owner role, exactly like production, so the
  // RLS policies (FORCE) bind it. Fixtures keep using the superuser URL.
  await applyRoles(pool, { appUser: APP_ROLE.user, appPassword: APP_ROLE.password });
  await pool.end();

  process.env['TEST_DATABASE_URL'] = pg.getConnectionUri();
  process.env['TEST_APP_DATABASE_URL'] = appRoleUrl(pg.getConnectionUri());
  process.env['TEST_REDIS_URL'] = redis.getConnectionUrl();

  return async () => {
    await Promise.all([pg.stop(), redis.stop()]);
  };
}

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import Redis from 'ioredis';
import { Pool } from 'pg';
import * as path from 'node:path';
import * as schema from '../../../drizzle/schema.js';
import { applyRoles } from '../../../drizzle/roles.mjs';
import { APP_ROLE, appRoleUrl } from './app-role.js';

export interface TestContainers {
  pg: StartedPostgreSqlContainer | null;
  redis: StartedRedisContainer | null;
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  /** Superuser: fixtures, truncation. Bypasses RLS. */
  databaseUrl: string;
  /** Least-privilege app role (what the Nest app uses as DATABASE_URL). Subject to RLS. */
  appDatabaseUrl: string;
  redisUrl: string;
}

let containers: TestContainers | null = null;

/**
 * Connects to the shared containers started by global-setup.ts. When a spec
 * is run without the integration config (no TEST_* env vars) it falls back to
 * starting its own containers and applying the migrations.
 */
export async function startContainers(): Promise<TestContainers> {
  if (containers) return containers;

  const sharedDb = process.env['TEST_DATABASE_URL'];
  const sharedRedis = process.env['TEST_REDIS_URL'];
  const sharedAppDb = process.env['TEST_APP_DATABASE_URL'];

  if (sharedDb && sharedRedis && sharedAppDb) {
    const pool = new Pool({ connectionString: sharedDb });
    containers = {
      pg: null,
      redis: null,
      pool,
      db: drizzle(pool, { schema }),
      databaseUrl: sharedDb,
      appDatabaseUrl: sharedAppDb,
      redisUrl: sharedRedis,
    };
  } else {
    const [pg, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:16.4-alpine').start(),
      new RedisContainer('redis:7.4-alpine').start(),
    ]);
    const pool = new Pool({ connectionString: pg.getConnectionUri() });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle/migrations') });
    await applyRoles(pool, { appUser: APP_ROLE.user, appPassword: APP_ROLE.password });
    containers = {
      pg,
      redis,
      db,
      pool,
      databaseUrl: pg.getConnectionUri(),
      appDatabaseUrl: appRoleUrl(pg.getConnectionUri()),
      redisUrl: redis.getConnectionUrl(),
    };
  }

  process.env['DATABASE_URL'] = containers.appDatabaseUrl;
  process.env['REDIS_URL'] = containers.redisUrl;

  return containers;
}

export async function stopContainers(): Promise<void> {
  if (!containers) return;
  const current = containers;
  containers = null;
  await current.pool.end();
  await Promise.all([current.pg?.stop(), current.redis?.stop()]);
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!containers) throw new Error('Containers not started. Call startContainers() first.');
  return containers.db;
}

export function getPool(): Pool {
  if (!containers) throw new Error('Containers not started.');
  return containers.pool;
}

/**
 * Per-test isolation for tests that commit (HTTP e2e): truncates every table
 * in the public schema (the drizzle migration bookkeeping lives in the
 * `drizzle` schema and is untouched) and flushes Redis.
 */
export async function resetState(): Promise<void> {
  if (!containers) throw new Error('Containers not started.');
  const tables = await containers.pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  if (tables.rows.length > 0) {
    const names = tables.rows.map((row) => `"public"."${row.tablename}"`).join(', ');
    await containers.pool.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }
  const redis = new Redis(containers.redisUrl);
  try {
    await redis.flushall();
  } finally {
    redis.disconnect();
  }
}

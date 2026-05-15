import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'node:path';
import * as schema from '../../../drizzle/schema.js';

export interface TestContainers {
  pg: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
}

let containers: TestContainers | null = null;

export async function startContainers(): Promise<TestContainers> {
  if (containers) return containers;

  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16.4-alpine').start(),
    new RedisContainer('redis:7.4-alpine').start(),
  ]);

  const pool = new Pool({ connectionString: pg.getConnectionUri() });
  const db = drizzle(pool, { schema });

  const migrationsFolder = path.resolve(process.cwd(), 'drizzle/migrations');
  await migrate(db, { migrationsFolder });

  containers = { pg, redis, db, pool };
  process.env['DATABASE_URL'] = pg.getConnectionUri();
  process.env['REDIS_URL'] = redis.getConnectionUrl();

  return containers;
}

export async function stopContainers(): Promise<void> {
  if (!containers) return;
  await containers.pool.end();
  await Promise.all([containers.pg.stop(), containers.redis.stop()]);
  containers = null;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!containers) throw new Error('Containers not started. Call startContainers() first.');
  return containers.db;
}

export function getPool(): Pool {
  if (!containers) throw new Error('Containers not started.');
  return containers.pool;
}

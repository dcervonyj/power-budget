import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Migrations need DDL and table ownership: use the owner/migrator role
// (MIGRATION_DATABASE_URL). DATABASE_URL (the least-privilege app role) is only
// a fallback so single-role setups keep working until the roles are split.
const pool = new Pool({
  connectionString:
    process.env['MIGRATION_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    'postgresql://power_budget:power_budget@localhost:5432/power_budget',
});

const db = drizzle(pool);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('Migrations applied');
await pool.end();

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env['DATABASE_URL'] ??
    'postgresql://power_budget:power_budget@localhost:5432/power_budget',
});

const db = drizzle(pool);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('Migrations applied');
await pool.end();

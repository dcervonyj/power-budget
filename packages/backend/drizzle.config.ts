import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://power_budget:power_budget@localhost:5432/power_budget',
  },
  verbose: true,
  strict: true,
});

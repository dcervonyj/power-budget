import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { categories } from '../schema.js';
import { SEED_CATEGORIES } from '../../src/domain/categories/seed-categories.js';
import { eq, isNull, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = drizzle(pool);

  console.log('Seeding default categories...');
  let inserted = 0;
  let skipped = 0;

  for (const cat of SEED_CATEGORIES) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.seedKey, cat.seedKey), isNull(categories.householdId)))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(categories).values({
      id: randomUUID(),
      householdId: null,
      seedKey: cat.seedKey,
      name: cat.names.en, // en as default; UI resolves locale at display time
      kind: cat.kind,
      icon: cat.icon,
      color: cat.color,
      archivedAt: null,
      createdAt: new Date(),
    });
    inserted++;
  }

  console.log(`Categories: ${inserted} inserted, ${skipped} skipped.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});

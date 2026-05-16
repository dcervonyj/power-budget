import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  users,
  households,
  householdUsers,
  bankConnections,
  bankAccounts,
  categories,
  plans,
  plannedItems,
  transactions,
  transactionMappings,
} from '../schema.js';

// ─── Fixed seed IDs — stable across re-runs for idempotency ──────────────────

const H_ID = 'ffffffff-beef-0000-0000-000000000001'; // household
const U_ID = 'ffffffff-beef-0000-0000-000000000002'; // user
const CN_ID = 'ffffffff-beef-0000-0000-000000000003'; // bank connection
const AC_ID = 'ffffffff-beef-0000-0000-000000000004'; // bank account
const PL_ID = 'ffffffff-beef-0000-0000-000000000005'; // plan

function catId(n: number): string {
  return `ffffffff-beef-0001-0000-${String(n).padStart(12, '0')}`;
}
function piId(n: number): string {
  return `ffffffff-beef-0002-0000-${String(n).padStart(12, '0')}`;
}

// ─── Category definitions (8 categories) ─────────────────────────────────────

const CATEGORY_DEFS = [
  { id: catId(1), name: 'PF Groceries', kind: 'expense' },
  { id: catId(2), name: 'PF Restaurants', kind: 'expense' },
  { id: catId(3), name: 'PF Transport', kind: 'expense' },
  { id: catId(4), name: 'PF Utilities', kind: 'expense' },
  { id: catId(5), name: 'PF Entertainment', kind: 'expense' },
  { id: catId(6), name: 'PF Salary', kind: 'income' },
  { id: catId(7), name: 'PF Freelance', kind: 'income' },
  { id: catId(8), name: 'PF Other Income', kind: 'income' },
] as const satisfies ReadonlyArray<{ id: string; name: string; kind: string }>;

// ─── Planned item definitions (20 items: 15 expense + 5 income) ──────────────

const PLANNED_ITEM_DEFS = [
  { id: piId(1), categoryId: catId(1), direction: 'expense', amountMinor: 300_000n },
  { id: piId(2), categoryId: catId(1), direction: 'expense', amountMinor: 150_000n },
  { id: piId(3), categoryId: catId(1), direction: 'expense', amountMinor: 50_000n },
  { id: piId(4), categoryId: catId(2), direction: 'expense', amountMinor: 200_000n },
  { id: piId(5), categoryId: catId(2), direction: 'expense', amountMinor: 80_000n },
  { id: piId(6), categoryId: catId(2), direction: 'expense', amountMinor: 40_000n },
  { id: piId(7), categoryId: catId(3), direction: 'expense', amountMinor: 100_000n },
  { id: piId(8), categoryId: catId(3), direction: 'expense', amountMinor: 60_000n },
  { id: piId(9), categoryId: catId(3), direction: 'expense', amountMinor: 30_000n },
  { id: piId(10), categoryId: catId(4), direction: 'expense', amountMinor: 500_000n },
  { id: piId(11), categoryId: catId(4), direction: 'expense', amountMinor: 200_000n },
  { id: piId(12), categoryId: catId(4), direction: 'expense', amountMinor: 100_000n },
  { id: piId(13), categoryId: catId(5), direction: 'expense', amountMinor: 150_000n },
  { id: piId(14), categoryId: catId(5), direction: 'expense', amountMinor: 80_000n },
  { id: piId(15), categoryId: catId(5), direction: 'expense', amountMinor: 50_000n },
  { id: piId(16), categoryId: catId(6), direction: 'income', amountMinor: 5_000_000n },
  { id: piId(17), categoryId: catId(6), direction: 'income', amountMinor: 2_000_000n },
  { id: piId(18), categoryId: catId(7), direction: 'income', amountMinor: 1_000_000n },
  { id: piId(19), categoryId: catId(7), direction: 'income', amountMinor: 500_000n },
  { id: piId(20), categoryId: catId(8), direction: 'income', amountMinor: 200_000n },
] as const satisfies ReadonlyArray<{
  id: string;
  categoryId: string;
  direction: string;
  amountMinor: bigint;
}>;

const TX_COUNT = 5000;
const BATCH_SIZE = 500;

function pickRoundRobin<T>(arr: ReadonlyArray<T>, index: number): T {
  if (arr.length === 0) throw new Error('Cannot pick from empty array');
  const item = arr[index % arr.length];
  if (item === undefined) throw new Error('Round-robin index out of bounds — this is a bug');
  return item;
}

async function seed(): Promise<void> {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  const db = drizzle(pool);

  // Idempotency: skip if household already exists
  const existing = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.id, H_ID))
    .limit(1);

  if (existing.length > 0) {
    console.log('Perf fixture already seeded — nothing to do.');
    await pool.end();
    return;
  }

  console.log('Seeding perf fixture...');

  // 1. User & Household
  await db.insert(users).values({
    id: U_ID,
    email: 'perf-fixture@power-budget.test',
    displayName: 'Perf Fixture User',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(households).values({
    id: H_ID,
    name: 'Perf Fixture Household',
    baseCurrency: 'PLN',
    createdAt: new Date(),
  });
  await db.insert(householdUsers).values({
    householdId: H_ID,
    userId: U_ID,
    role: 'owner',
    joinedAt: new Date(),
  });
  console.log('  1 user + 1 household inserted');

  // 2. Bank connection + account (transactions require an account FK)
  await db.insert(bankConnections).values({
    id: CN_ID,
    householdId: H_ID,
    userId: U_ID,
    provider: 'gocardless',
    bankId: 'PERF_BANK',
    status: 'active',
    createdAt: new Date(),
  });
  await db.insert(bankAccounts).values({
    id: AC_ID,
    householdId: H_ID,
    connectionId: CN_ID,
    externalId: 'perf-account-001',
    name: 'Perf Test Account',
    currency: 'PLN',
    createdAt: new Date(),
  });
  console.log('  1 bank connection + 1 bank account inserted');

  // 3. Categories
  await db.insert(categories).values(
    CATEGORY_DEFS.map((c) => ({
      id: c.id,
      householdId: H_ID,
      name: c.name,
      kind: c.kind,
      icon: 'tag',
      color: '#6B7280',
      createdAt: new Date(),
    })),
  );
  console.log(`  ${CATEGORY_DEFS.length} categories inserted`);

  // 4. Plan (12-month span: Jan–Dec 2024)
  await db.insert(plans).values({
    id: PL_ID,
    householdId: H_ID,
    ownerUserId: U_ID,
    name: 'Perf Fixture 2024',
    type: 'household',
    periodKind: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-12-31',
    baseCurrency: 'PLN',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 5. Planned items (20)
  await db.insert(plannedItems).values(
    PLANNED_ITEM_DEFS.map((pi) => ({
      id: pi.id,
      planId: PL_ID,
      householdId: H_ID,
      categoryId: pi.categoryId,
      direction: pi.direction,
      amountMinor: pi.amountMinor,
      currency: 'PLN',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
  console.log(`  1 plan + ${PLANNED_ITEM_DEFS.length} planned items inserted`);

  // 6. Transactions + mappings in batches
  let txInserted = 0;

  for (let batchStart = 0; batchStart < TX_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, TX_COUNT);

    const txBatch: Array<{
      id: string;
      householdId: string;
      accountId: string;
      externalId: string;
      occurredOn: string;
      amountMinor: bigint;
      currency: string;
      description: string;
      source: string;
      createdAt: Date;
    }> = [];

    const mappingBatch: Array<{
      transactionId: string;
      plannedItemId: string;
      amountMinor: bigint;
      currency: string;
      mappedBy: string;
      mappedAt: Date;
    }> = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const txId = randomUUID();
      const month = (i % 12) + 1;
      const day = (Math.floor(i / 12) % 28) + 1;
      const occurredOn = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const amountMinor = BigInt(((i % 50) + 1) * 1000);
      const pi = pickRoundRobin(PLANNED_ITEM_DEFS, i);

      txBatch.push({
        id: txId,
        householdId: H_ID,
        accountId: AC_ID,
        externalId: `perf-txn-${String(i + 1).padStart(5, '0')}`,
        occurredOn,
        amountMinor,
        currency: 'PLN',
        description: `Perf test transaction ${i + 1}`,
        source: 'manual',
        createdAt: new Date(),
      });

      mappingBatch.push({
        transactionId: txId,
        plannedItemId: pi.id,
        amountMinor,
        currency: 'PLN',
        mappedBy: U_ID,
        mappedAt: new Date(),
      });
    }

    await db.insert(transactions).values(txBatch);
    await db.insert(transactionMappings).values(mappingBatch);
    txInserted += txBatch.length;
    process.stdout.write(`\r  progress: ${txInserted}/${TX_COUNT} transactions`);
  }

  console.log('\n');
  console.log('Perf fixture seeded successfully:');
  console.log(`  household: 1, user: 1`);
  console.log(`  bank connection: 1, bank account: 1`);
  console.log(`  categories: ${CATEGORY_DEFS.length}`);
  console.log(`  plan: 1, planned items: ${PLANNED_ITEM_DEFS.length}`);
  console.log(`  transactions: ${txInserted}, mappings: ${txInserted}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Perf seed failed', err);
  process.exit(1);
});

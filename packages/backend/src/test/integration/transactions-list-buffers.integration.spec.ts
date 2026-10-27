import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Logger } from 'drizzle-orm';
import { HouseholdId, UserId } from '@power-budget/core';
import * as schema from '../../../drizzle/schema.js';
import type { TransactionQuery } from '../../domain/transactions/entities.js';
import { DrizzleTransactionRepository } from '../../infrastructure/transactions/DrizzleTransactionRepository.js';
import { encodeTransactionCursor } from '../../infrastructure/transactions/transactionCursor.js';
import { APP_ROLE } from './app-role.js';
import { getPool, resetState, startContainers, stopContainers } from './setup.js';

/** Households in the fixture; each has 2 users, 3 accounts and 5,000 transactions. */
const HOUSEHOLDS = 2;
/** Upper bound of shared buffers (hit + read) for one `GET /transactions` page. */
const BUFFERS_PER_PAGE = 2_000;

// UUIDv7-shaped fixture ids, so the branded ids accept them.
const HOUSEHOLD = '10000000-0000-7000-8000-000000000001';
const OWNER = '00000000-0000-7000-8000-000000000001';

/**
 * Shape of the audit perf fixture (docs/handoff/audit-2610/perf-sql/perf-seed.sql): per household
 * 2 users, 3 accounts (user 1 owns 2), 5,000 transactions over two years, 24 monthly plans of 15
 * items, about 70% of the rows mapped and 3% in a transfer.
 */
const FIXTURE_SQL = `
SET session_replication_role = replica;
INSERT INTO users (id, email)
  SELECT ('00000000-0000-7000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, 'u' || g || '@x.io'
  FROM generate_series(1, ${HOUSEHOLDS * 2}) g;
INSERT INTO households (id, name, base_currency)
  SELECT ('10000000-0000-7000-8000-' || lpad(to_hex(h), 12, '0'))::uuid, 'h' || h, 'PLN'
  FROM generate_series(1, ${HOUSEHOLDS}) h;
INSERT INTO household_users (household_id, user_id, role)
  SELECT ('10000000-0000-7000-8000-' || lpad(to_hex(((g - 1) / 2) + 1), 12, '0'))::uuid,
    ('00000000-0000-7000-8000-' || lpad(to_hex(g), 12, '0'))::uuid,
    CASE WHEN g % 2 = 1 THEN 'owner' ELSE 'member' END
  FROM generate_series(1, ${HOUSEHOLDS * 2}) g;
INSERT INTO bank_accounts (id, household_id, kind, owner_user_id, name, currency)
  SELECT ('20000000-0000-7000-8000-' || lpad(to_hex(a), 12, '0'))::uuid,
    ('10000000-0000-7000-8000-' || lpad(to_hex(((a - 1) / 3) + 1), 12, '0'))::uuid, 'manual',
    ('00000000-0000-7000-8000-' || lpad(to_hex(((a - 1) / 3) * 2 + 1 + (a % 3 = 0)::int), 12, '0'))::uuid,
    'acc' || a, CASE WHEN a % 3 = 2 THEN 'EUR' ELSE 'PLN' END
  FROM generate_series(1, ${HOUSEHOLDS * 3}) a;
INSERT INTO categories (id, household_id, name)
  SELECT ('30000000-0000-7000-8000-' || lpad(to_hex(c), 12, '0'))::uuid, NULL, 'cat' || c
  FROM generate_series(1, 15) c;
INSERT INTO plans (id, household_id, owner_user_id, name, type, period_kind, period_start, period_end, base_currency)
  SELECT ('40000000-0000-7000-8000-' || lpad(to_hex((h - 1) * 24 + m), 12, '0'))::uuid,
    ('10000000-0000-7000-8000-' || lpad(to_hex(h), 12, '0'))::uuid, NULL, 'p', 'household', 'monthly',
    (date '2024-11-01' + make_interval(months => m - 1))::date,
    ((date '2024-11-01' + make_interval(months => m))::date - 1), 'PLN'
  FROM generate_series(1, ${HOUSEHOLDS}) h, generate_series(1, 24) m;
INSERT INTO planned_items (id, plan_id, household_id, category_id, direction, amount_minor, currency)
  SELECT ('50000000-0000-7000-8000-' || lpad(to_hex(((p - 1) * 15) + i), 12, '0'))::uuid,
    ('40000000-0000-7000-8000-' || lpad(to_hex(p), 12, '0'))::uuid,
    ('10000000-0000-7000-8000-' || lpad(to_hex(((p - 1) / 24) + 1), 12, '0'))::uuid,
    ('30000000-0000-7000-8000-' || lpad(to_hex(i), 12, '0'))::uuid,
    CASE WHEN i = 1 THEN 'income' ELSE 'expense' END, 100000, 'PLN'
  FROM generate_series(1, ${HOUSEHOLDS * 24}) p, generate_series(1, 15) i;
INSERT INTO transactions (id, household_id, account_id, external_id, occurred_on, amount_minor, currency, description, merchant, source)
  SELECT gen_random_uuid(), ('10000000-0000-7000-8000-' || lpad(to_hex(h), 12, '0'))::uuid,
    ('20000000-0000-7000-8000-' || lpad(to_hex((h - 1) * 3 + 1 + (n % 3)), 12, '0'))::uuid, 'ext' || h || '-' || n,
    (date '2026-10-26' - (n * 730 / 5000)), -((n % 97) + 1) * 1000,
    CASE WHEN n % 3 = 1 THEN 'EUR' ELSE 'PLN' END, 'CARD PAYMENT SHOP ' || (n % 300), 'shop' || (n % 300), 'bank_sync'
  FROM generate_series(1, ${HOUSEHOLDS}) h, generate_series(1, 5000) n;
INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
  SELECT t.id, pi.id, t.amount_minor, t.currency, '00000000-0000-7000-8000-000000000001'
  FROM transactions t
  JOIN plans p ON p.household_id = t.household_id AND t.occurred_on BETWEEN p.period_start AND p.period_end
  JOIN planned_items pi ON pi.plan_id = p.id
    AND pi.category_id = ('30000000-0000-7000-8000-' || lpad(to_hex(2 + (abs(hashtext(t.id::text)) % 14)), 12, '0'))::uuid
  WHERE abs(hashtext(t.id::text)) % 10 < 7;
WITH s AS (
  SELECT id, household_id, row_number() OVER (PARTITION BY household_id ORDER BY id) rn
  FROM transactions WHERE abs(hashtext(id::text || 'x')) % 100 < 6
)
INSERT INTO transfers (id, household_id, tx_a_id, tx_b_id, marked_by)
  SELECT gen_random_uuid(), a.household_id, a.id, b.id, '00000000-0000-7000-8000-000000000001'
  FROM s a JOIN s b ON a.household_id = b.household_id AND b.rn = a.rn + 1 WHERE a.rn % 2 = 1;
SET session_replication_role = origin;
ANALYZE;
`;

interface CapturedQuery {
  readonly sql: string;
  readonly params: unknown[];
}

interface ExplainNode {
  readonly 'Shared Hit Blocks': number;
  readonly 'Shared Read Blocks': number;
}

interface ExplainRow {
  readonly 'QUERY PLAN': { readonly Plan: ExplainNode }[];
}

class CapturingLogger implements Logger {
  private captured: CapturedQuery | null = null;

  logQuery(query: string, params: unknown[]): void {
    this.captured = { sql: query, params };
  }

  last(): CapturedQuery {
    if (this.captured === null) {
      throw new Error('No query was captured');
    }

    return this.captured;
  }
}

/**
 * CLN-048 (audit PERF-01): `GET /transactions` used to join mappings, plans, categories and both
 * transfer sides for every row the caller owns before `LIMIT`, so a page cost grew with the
 * history (54,868 buffers for 3,333 own rows). The page ids are now picked first, then joined.
 * Measured with EXPLAIN (ANALYZE, BUFFERS) as the least-privilege app role under RLS.
 */
describe('Integration: GET /transactions page cost does not grow with history (CLN-048)', () => {
  const logger = new CapturingLogger();
  const scope = { householdId: HouseholdId.of(HOUSEHOLD) };
  let repository: DrizzleTransactionRepository;
  let midCursor: string;

  beforeAll(async () => {
    await startContainers();
    await resetState();
    await getPool().query(FIXTURE_SQL);
    repository = new DrizzleTransactionRepository(drizzle(getPool(), { schema, logger }));
    midCursor = await cursorAtOwnRow(2_500);
  }, 300_000);

  afterAll(async () => {
    await stopContainers();
  });

  it.each<[string, Partial<TransactionQuery>]>([
    ['first page', {}],
    ['unmappedOnly', { unmappedOnly: true }],
    ['mapped', { mapped: true }],
    ['transfers only', { transfer: true }],
    ['no transfers', { transfer: false }],
  ])('reads under the buffer budget: %s', async (_name, filters) => {
    const page = await repository.list(query(filters), scope);

    expect(page.items.length).toBeGreaterThan(0);
    const buffers = await buffersOf(logger.last());
    console.info(`CLN048 ${expect.getState().currentTestName} buffers=${buffers}`);
    expect(buffers).toBeLessThan(BUFFERS_PER_PAGE);
  });

  it('reads under the buffer budget for a page deep in the history', async () => {
    const page = await repository.list(query({ cursor: midCursor }), scope);

    expect(page.items).toHaveLength(50);
    const buffers = await buffersOf(logger.last());
    console.info(`CLN048 ${expect.getState().currentTestName} buffers=${buffers}`);
    expect(buffers).toBeLessThan(BUFFERS_PER_PAGE);
  });

  function query(filters: Partial<TransactionQuery>): TransactionQuery {
    return {
      householdId: HouseholdId.of(HOUSEHOLD),
      ownerUserId: UserId.of(OWNER),
      limit: 50,
      ...filters,
    };
  }

  async function cursorAtOwnRow(offset: number): Promise<string> {
    const { rows } = await getPool().query<{ occurred_on: string; id: string }>(
      `SELECT to_char(t.occurred_on, 'YYYY-MM-DD') AS occurred_on, t.id
       FROM transactions t JOIN bank_accounts ba ON ba.id = t.account_id
       WHERE t.household_id = $1 AND ba.owner_user_id = $2
       ORDER BY t.occurred_on DESC, t.id DESC OFFSET $3 LIMIT 1`,
      [HOUSEHOLD, OWNER, offset],
    );
    const row = rows[0];
    if (!row) {
      throw new Error('Fixture has fewer own rows than the offset');
    }

    return encodeTransactionCursor({ occurredOn: row.occurred_on, id: row.id });
  }

  /** Runs the captured statement as the app role with the settings ScopedPool sets. */
  async function buffersOf(captured: CapturedQuery): Promise<number> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${APP_ROLE.user}`);
      await client.query(
        `SELECT set_config('app.household_id', $1, true), set_config('app.user_id', $2, true),
                set_config('app.rls_bypass', '', true)`,
        [HOUSEHOLD, OWNER],
      );
      const { rows } = await client.query<ExplainRow>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${captured.sql}`,
        captured.params,
      );
      const plan = rows[0]?.['QUERY PLAN'][0]?.Plan;
      if (!plan) {
        throw new Error('EXPLAIN returned no plan');
      }

      return plan['Shared Hit Blocks'] + plan['Shared Read Blocks'];
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }
});

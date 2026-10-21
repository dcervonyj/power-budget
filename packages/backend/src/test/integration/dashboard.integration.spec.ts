import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { startContainers, stopContainers, resetState, getPool } from './setup.js';
import { createTestApp } from './app.js';

const PASSWORD = 'Str0ngPass!';
const GROCERIES = '550e8400-e29b-41d4-a716-446655440000';
// A past month, so the dashboard takes its FX rates for the period end (2026-09-30).
const PERIOD_START = '2026-09-01';
const RATE_DATE = '2026-09-30';

interface Member {
  readonly userId: string;
  readonly householdId: string;
  readonly auth: { authorization: string };
}

interface MoneyBody {
  readonly amountMinor: string;
  readonly currency: string;
}

interface LineBody {
  readonly plannedItemId: string;
  readonly planned: MoneyBody;
  readonly actual: MoneyBody;
}

interface DashboardBody {
  readonly baseCurrency: string;
  readonly expenseLines: LineBody[];
  readonly totalPlannedExpenses: MoneyBody;
  readonly totalActualExpenses: MoneyBody;
  readonly unplannedExpenses: MoneyBody;
  readonly unplannedIncome: MoneyBody;
  readonly net: MoneyBody;
}

interface CategoryBody {
  readonly categoryId: string;
  readonly privacyLevel: string;
  readonly totalAmountMinor: string;
  readonly currency: string;
  readonly transactionCount: number;
}

/**
 * CLN-012 (audit H17-H19, H22, M2): dashboard numbers come from core
 * computePlanActuals / aggregateByCategoryWithPrivacy with an FX table, with
 * per-owner privacy, on the real AppModule (Fastify inject).
 */
describe('Plan and household dashboards (real app)', () => {
  let app: NestFastifyApplication;
  let anna: Member;
  let bob: Member;
  let planId: string;
  let groceriesItem: string;
  let travelItem: string;
  let annaAccount: string;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    await getPool().query(
      `INSERT INTO categories (id, household_id, seed_key, name, kind)
       VALUES ($1, NULL, 'expense.groceries', 'Groceries', 'expense')`,
      [GROCERIES],
    );
    await getPool().query(
      `INSERT INTO fx_rates (id, base, quote, rate_on_date, rate, source)
       VALUES ($1, 'EUR', 'PLN', $2, '4.25', 'ecb')`,
      [uuidv7(), RATE_DATE],
    );
    anna = await register('anna-d@example.com');
    bob = await partnerOf(anna, 'bob-d@example.com');
    await seedActivity();
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  /**
   * Household plan in PLN: Groceries 1 000.00 PLN (seeded category) and Travel 100.00 EUR.
   * Anna (PLN account): groceries -200.00, refund +50.00, plus an ignored, a transfer
   * and an out-of-period transaction. Bob (private EUR account): groceries -10.00 EUR,
   * unplanned taxi -20.00 EUR.
   */
  async function seedActivity(): Promise<void> {
    planId = await createPlan(anna, 'household', 'PLN');
    groceriesItem = await addItem(anna, planId, GROCERIES, '100000', 'PLN');
    const travel = await createCategory(anna, 'Travel');
    travelItem = await addItem(anna, planId, travel, '10000', 'EUR');

    annaAccount = await insertAccount(anna, 'PLN');
    const bobAccount = await insertAccount(bob, 'EUR');
    const buy = await insertTx(anna, annaAccount, '2026-09-05', -20000n, 'PLN', 'Market');
    const refund = await insertTx(anna, annaAccount, '2026-09-06', 5000n, 'PLN', 'Market refund');
    await insertTx(anna, annaAccount, '2026-09-07', -99900n, 'PLN', 'Ignored', true);
    const toSavings = await insertTx(anna, annaAccount, '2026-09-08', -30000n, 'PLN', 'Savings');
    await insertTx(anna, annaAccount, '2026-10-01', -7000n, 'PLN', 'Next month');
    const bobGroceries = await insertTx(bob, bobAccount, '2026-09-10', -1000n, 'EUR', 'Bob secret');
    await insertTx(bob, bobAccount, '2026-09-11', -2000n, 'EUR', 'Bob private taxi');

    await insertMapping(buy, groceriesItem, anna);
    await insertMapping(refund, groceriesItem, anna);
    await insertMapping(bobGroceries, groceriesItem, bob);
    await getPool().query(
      `INSERT INTO transfers (id, household_id, tx_a_id, tx_b_id, marked_by)
       VALUES ($1, $2, $3, NULL, $4)`,
      [uuidv7(), anna.householdId, toSavings, anna.userId],
    );
  }

  describe('GET /plans/:id/dashboard', () => {
    it('converts PLN and EUR into the base currency, signs refunds and skips ignored, transfers and other periods', async () => {
      const res = await get<DashboardBody>(anna, `/plans/${planId}/dashboard`);

      expect(res.status).toBe(200);
      const lines = new Map(res.body.expenseLines.map((l) => [l.plannedItemId, l]));
      // -200.00 + 50.00 PLN, and Bob's -10.00 EUR = 42.50 PLN
      expect(lines.get(groceriesItem)).toMatchObject({
        planned: { amountMinor: '100000', currency: 'PLN' },
        actual: { amountMinor: '19250', currency: 'PLN' },
      });
      expect(lines.get(travelItem)).toMatchObject({
        planned: { amountMinor: '42500', currency: 'PLN' },
        actual: { amountMinor: '0', currency: 'PLN' },
      });
      expect(res.body.totalPlannedExpenses).toEqual({ amountMinor: '142500', currency: 'PLN' });
      expect(res.body.totalActualExpenses).toEqual({ amountMinor: '19250', currency: 'PLN' });
      // Bob's unplanned taxi counts in the household total (aggregate only): 20.00 EUR
      expect(res.body.unplannedExpenses).toEqual({ amountMinor: '8500', currency: 'PLN' });
      expect(res.body.unplannedIncome).toEqual({ amountMinor: '0', currency: 'PLN' });
      expect(res.body.net).toEqual({ amountMinor: '-27750', currency: 'PLN' });
    });

    it('counts only the owner transactions as unplanned in a personal plan', async () => {
      const personal = await createPlan(anna, 'personal', 'PLN');

      const res = await get<DashboardBody>(anna, `/plans/${personal}/dashboard`);

      expect(res.status).toBe(200);
      // Anna's unmapped buy and refund belong to the household plan; nothing of Bob's shows.
      expect(res.body.unplannedExpenses).toEqual({ amountMinor: '0', currency: 'PLN' });
    });

    it('answers 503 fx_rate_unavailable instead of 500 when a rate is missing', async () => {
      const usdPlan = await createPlan(anna, 'personal', 'USD');
      await insertTx(anna, annaAccount, '2026-09-20', -1500n, 'PLN', 'Coffee');

      const res = await get<{ code: string }>(anna, `/plans/${usdPlan}/dashboard`);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('fx_rate_unavailable');
    });
  });

  describe('GET /households/:id/dashboard', () => {
    it('includes the seeded category and shows the partner only as an aggregate', async () => {
      const res = await get<{ categories: CategoryBody[] }>(
        anna,
        `/households/${anna.householdId}/dashboard?planId=${planId}`,
      );

      expect(res.status).toBe(200);
      expect(res.raw).not.toContain('Bob secret');
      const groceries = res.body.categories.find((c) => c.categoryId === GROCERIES);
      expect(groceries).toEqual({
        categoryId: GROCERIES,
        categoryName: 'Groceries',
        privacyLevel: 'total_only',
        totalAmountMinor: '19250',
        currency: 'PLN',
        // Anna's own two; Bob's transaction stays hidden at the default total_only level.
        transactionCount: 2,
      });
    });

    it("gives the partner his own count and Anna's total, never her transactions", async () => {
      const res = await get<{ categories: CategoryBody[] }>(
        bob,
        `/households/${bob.householdId}/dashboard?planId=${planId}`,
      );

      expect(res.status).toBe(200);
      expect(res.raw).not.toContain('Market');
      const groceries = res.body.categories.find((c) => c.categoryId === GROCERIES);
      expect(groceries).toMatchObject({ totalAmountMinor: '19250', transactionCount: 1 });
    });
  });

  describe('GET /plans/:id/dashboard/unplanned', () => {
    it("lists only the caller's own transactions", async () => {
      const annaList = await get<{ items: { description: string }[] }>(
        anna,
        `/plans/${planId}/dashboard/unplanned?direction=expense&limit=1000`,
      );
      const bobList = await get<{ items: { description: string }[] }>(
        bob,
        `/plans/${planId}/dashboard/unplanned?direction=expense`,
      );

      expect(annaList.status).toBe(200);
      expect(annaList.raw).not.toContain('Bob private taxi');
      expect(annaList.body.items).toEqual([]);
      expect(bobList.body.items.map((i) => i.description)).toEqual(['Bob private taxi']);
    });
  });

  async function get<T>(
    member: Member,
    url: string,
  ): Promise<{ status: number; body: T; raw: string }> {
    const res = await app.inject({ method: 'GET', url, headers: member.auth });

    return { status: res.statusCode, body: res.json<T>(), raw: res.body };
  }

  async function register(email: string): Promise<Member> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    const { userId, accessToken } = res.json<{ userId: string; accessToken: string }>();

    return {
      userId,
      householdId: await householdOf(userId),
      auth: { authorization: `Bearer ${accessToken}` },
    };
  }

  /** Moves `email` into the household of `owner` (the invite flow is CLN-006) and logs in again. */
  async function partnerOf(owner: Member, email: string): Promise<Member> {
    const partner = await register(email);
    await getPool().query('UPDATE household_users SET household_id = $1 WHERE user_id = $2', [
      owner.householdId,
      partner.userId,
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: PASSWORD },
    });
    expect(login.statusCode).toBe(201);

    return {
      userId: partner.userId,
      householdId: owner.householdId,
      auth: { authorization: `Bearer ${login.json<{ accessToken: string }>().accessToken}` },
    };
  }

  async function householdOf(userId: string): Promise<string> {
    const rows = await getPool().query<{ household_id: string }>(
      'SELECT household_id FROM household_users WHERE user_id = $1',
      [userId],
    );

    return rows.rows[0]?.household_id ?? '';
  }

  async function createPlan(
    member: Member,
    type: 'household' | 'personal',
    baseCurrency: string,
  ): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/plans',
      headers: member.auth,
      payload: {
        name: `${type} ${baseCurrency}`,
        type,
        periodKind: 'monthly',
        periodStart: PERIOD_START,
        baseCurrency,
      },
    });
    expect(res.statusCode).toBe(201);

    return res.json<{ id: string }>().id;
  }

  async function createCategory(member: Member, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/categories',
      headers: member.auth,
      payload: { name, kind: 'expense' },
    });
    expect(res.statusCode).toBe(201);

    return res.json<{ id: string }>().id;
  }

  async function addItem(
    member: Member,
    plan: string,
    categoryId: string,
    amountMinor: string,
    currency: string,
  ): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: `/plans/${plan}/items`,
      headers: member.auth,
      payload: { categoryId, direction: 'expense', amountMinor, currency },
    });
    expect(res.statusCode).toBe(201);

    return res.json<{ id: string }>().id;
  }

  async function insertAccount(member: Member, currency: string): Promise<string> {
    const connection = uuidv7();
    const account = uuidv7();
    await getPool().query(
      `INSERT INTO bank_connections (id, household_id, user_id, provider, bank_id)
       VALUES ($1, $2, $3, 'manual', 'manual')`,
      [connection, member.householdId, member.userId],
    );
    await getPool().query(
      `INSERT INTO bank_accounts (id, household_id, connection_id, external_id, name, currency)
       VALUES ($1, $2, $3, $4, 'Main', $5)`,
      [account, member.householdId, connection, account, currency],
    );

    return account;
  }

  async function insertTx(
    member: Member,
    account: string,
    occurredOn: string,
    amountMinor: bigint,
    currency: string,
    description: string,
    ignored = false,
  ): Promise<string> {
    const id = uuidv7();
    await getPool().query(
      `INSERT INTO transactions (id, household_id, account_id, occurred_on, amount_minor, currency, description, ignored)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        member.householdId,
        account,
        occurredOn,
        amountMinor.toString(),
        currency,
        description,
        ignored,
      ],
    );

    return id;
  }

  async function insertMapping(transaction: string, item: string, by: Member): Promise<void> {
    await getPool().query(
      `INSERT INTO transaction_mappings (transaction_id, planned_item_id, amount_minor, currency, mapped_by)
       SELECT id, $2, amount_minor, currency, $3 FROM transactions WHERE id = $1`,
      [transaction, item, by.userId],
    );
  }
});

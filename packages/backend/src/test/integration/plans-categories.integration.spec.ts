import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { ISO_UTC_PATTERN, UUID_PATTERN } from './test-helpers.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { startContainers, stopContainers, resetState, getPool } from './setup.js';
import { createTestApp } from './app.js';

const PASSWORD = 'Str0ngPass!';
const SYSTEM_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440000';

interface Member {
  readonly userId: string;
  readonly householdId: string;
  readonly auth: { authorization: string };
}

interface PlanBody {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly period: { start: string; end: string };
  readonly archivedAt: string | null;
}

/**
 * CLN-011 (audit C9, M13): plans, planned items, history, clone and archive;
 * categories; user preferences, on the real AppModule (Fastify inject).
 */
describe('Plans, categories and preferences API (real app)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetState();
    // A seeded system category (household_id NULL) with a v4 id, as in production.
    await getPool().query(
      `INSERT INTO categories (id, household_id, seed_key, name, kind)
       VALUES ($1, NULL, 'expense.groceries', 'Groceries', 'expense')`,
      [SYSTEM_CATEGORY_ID],
    );
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

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
    const id = rows.rows[0]?.household_id;
    expect(id).toMatch(UUID_PATTERN);

    return id ?? '';
  }

  async function createPlan(member: Member, payload: Record<string, unknown>): Promise<PlanBody> {
    const res = await app.inject({ method: 'POST', url: '/plans', headers: member.auth, payload });
    expect(res.statusCode).toBe(201);

    return res.json<PlanBody>();
  }

  function monthly(type: 'household' | 'personal', start = '2026-10-01'): Record<string, unknown> {
    return {
      name: `${type} ${start}`,
      type,
      periodKind: 'monthly',
      periodStart: start,
      baseCurrency: 'PLN',
    };
  }

  describe('plans', () => {
    it('creates, gets, lists, renames, archives and filters by status', async () => {
      const anna = await register('anna@example.com');

      const plan = await createPlan(anna, monthly('household'));
      expect(plan).toMatchObject({
        type: 'household',
        period: { start: '2026-10-01', end: '2026-10-31' },
        archivedAt: null,
      });

      const got = await app.inject({ method: 'GET', url: `/plans/${plan.id}`, headers: anna.auth });
      expect(got.statusCode).toBe(200);
      expect(got.json()).toEqual(plan);

      const renamed = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}`,
        headers: anna.auth,
        payload: { name: 'October', baseCurrency: 'EUR' },
      });
      expect(renamed.statusCode).toBe(200);
      expect(renamed.json()).toMatchObject({ id: plan.id, name: 'October', baseCurrency: 'EUR' });

      const archived = await app.inject({
        method: 'POST',
        url: `/plans/${plan.id}/archive`,
        headers: anna.auth,
      });
      expect(archived.statusCode).toBe(204);

      const active = await app.inject({ method: 'GET', url: '/plans', headers: anna.auth });
      expect(active.json()).toEqual([]);
      const archivedList = await app.inject({
        method: 'GET',
        url: '/plans?status=archived',
        headers: anna.auth,
      });
      expect(archivedList.json<PlanBody[]>().map((p) => p.id)).toEqual([plan.id]);

      const readOnly = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}`,
        headers: anna.auth,
        payload: { name: 'Again' },
      });
      expect(readOnly.statusCode).toBe(409);
      expect(readOnly.json()).toMatchObject({ code: 'plan_archived' });
    });

    it('checks overlap against the plan period, not today (M13)', async () => {
      const anna = await register('overlap@example.com');
      await createPlan(anna, monthly('household', '2030-01-01'));

      const overlapping = await app.inject({
        method: 'POST',
        url: '/plans',
        headers: anna.auth,
        payload: monthly('household', '2030-01-15'),
      });
      expect(overlapping.statusCode).toBe(409);
      expect(overlapping.json()).toMatchObject({ code: 'plan_duplicate' });

      await createPlan(anna, monthly('household', '2030-02-01'));
    });

    it("hides a partner's personal plan and shares household plans", async () => {
      const anna = await register('anna-p@example.com');
      const ben = await partnerOf(anna, 'ben-p@example.com');
      const shared = await createPlan(anna, monthly('household'));
      const annas = await createPlan(anna, monthly('personal'));
      const bens = await createPlan(ben, monthly('personal'));

      const benList = await app.inject({ method: 'GET', url: '/plans', headers: ben.auth });
      expect(
        benList
          .json<PlanBody[]>()
          .map((p) => p.id)
          .sort(),
      ).toEqual([shared.id, bens.id].sort());

      const peek = await app.inject({
        method: 'GET',
        url: `/plans/${annas.id}`,
        headers: ben.auth,
      });
      expect(peek.statusCode).toBe(404);
      expect(peek.json()).toMatchObject({ code: 'plan_not_found' });
    });

    it("returns 404 for another household's plan on every route", async () => {
      const anna = await register('anna-h@example.com');
      const eve = await register('eve-h@example.com');
      const plan = await createPlan(anna, monthly('household'));

      const routes: { method: 'GET' | 'PATCH' | 'POST'; url: string; payload?: object }[] = [
        { method: 'GET', url: `/plans/${plan.id}` },
        { method: 'PATCH', url: `/plans/${plan.id}`, payload: { name: 'x' } },
        { method: 'POST', url: `/plans/${plan.id}/archive` },
        { method: 'POST', url: `/plans/${plan.id}/clone`, payload: {} },
        { method: 'GET', url: `/plans/${plan.id}/items` },
        { method: 'GET', url: `/plans/${plan.id}/dashboard` },
      ];
      for (const route of routes) {
        const res = await app.inject({ ...route, headers: eve.auth });
        expect({ url: route.url, status: res.statusCode }).toEqual({ url: route.url, status: 404 });
      }
    });

    it('validates bodies and ids with 400', async () => {
      const anna = await register('anna-v@example.com');

      const badBody = await app.inject({
        method: 'POST',
        url: '/plans',
        headers: anna.auth,
        payload: {
          name: '',
          type: 'shared',
          periodKind: 'monthly',
          periodStart: '1 Oct',
          baseCurrency: 'XXX',
        },
      });
      expect(badBody.statusCode).toBe(400);
      expect(badBody.json<{ errors: { field: string }[] }>().errors.map((e) => e.field)).toEqual([
        'name',
        'type',
        'periodStart',
        'baseCurrency',
      ]);

      const customWithoutEnd = await app.inject({
        method: 'POST',
        url: '/plans',
        headers: anna.auth,
        payload: { ...monthly('household'), periodKind: 'custom' },
      });
      expect(customWithoutEnd.statusCode).toBe(400);
      expect(customWithoutEnd.json()).toMatchObject({ code: 'plan_period_invalid' });

      const v4Id = await app.inject({
        method: 'GET',
        url: `/plans/${SYSTEM_CATEGORY_ID}`,
        headers: anna.auth,
      });
      expect(v4Id.statusCode).toBe(400);
    });
  });

  describe('planned items, history and clone', () => {
    it('adds, updates (with history), lists, clones and removes items', async () => {
      const anna = await register('anna-i@example.com');
      const plan = await createPlan(anna, monthly('household'));

      const created = await app.inject({
        method: 'POST',
        url: `/plans/${plan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: SYSTEM_CATEGORY_ID,
          direction: 'expense',
          amountMinor: '150000',
          currency: 'PLN',
        },
      });
      expect(created.statusCode).toBe(201);
      const item = created.json<{ id: string }>();
      expect(created.json()).toMatchObject({
        planId: plan.id,
        categoryId: SYSTEM_CATEGORY_ID,
        amount: { amountMinor: '150000', currency: 'PLN' },
        note: null,
      });

      const updated = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}/items/${item.id}`,
        headers: anna.auth,
        payload: {
          amountMinor: '9007199254740993',
          currency: 'PLN',
          note: 'more',
          reason: 'raise',
        },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        amount: { amountMinor: '9007199254740993', currency: 'PLN' },
        note: 'more',
      });

      const history = await app.inject({
        method: 'GET',
        url: `/plans/${plan.id}/items/${item.id}/history`,
        headers: anna.auth,
      });
      expect(history.statusCode).toBe(200);
      expect(history.json()).toEqual([
        {
          id: expect.stringMatching(UUID_PATTERN),
          plannedItemId: item.id,
          before: {
            amount: { amountMinor: '150000', currency: 'PLN' },
            note: null,
            matchHint: null,
          },
          after: { amount: { amountMinor: '9007199254740993', currency: 'PLN' }, note: 'more' },
          changedBy: anna.userId,
          changedAt: expect.stringMatching(ISO_UTC_PATTERN),
          reason: 'raise',
        },
      ]);

      const cloned = await app.inject({
        method: 'POST',
        url: `/plans/${plan.id}/clone`,
        headers: anna.auth,
        payload: {},
      });
      expect(cloned.statusCode).toBe(201);
      const clone = cloned.json<PlanBody>();
      expect(clone.period).toEqual({ start: '2026-11-01', end: '2026-11-30' });
      const cloneItems = await app.inject({
        method: 'GET',
        url: `/plans/${clone.id}/items`,
        headers: anna.auth,
      });
      expect(cloneItems.json()).toMatchObject([
        { planId: clone.id, amount: { amountMinor: '9007199254740993', currency: 'PLN' } },
      ]);

      const removed = await app.inject({
        method: 'DELETE',
        url: `/plans/${plan.id}/items/${item.id}`,
        headers: anna.auth,
      });
      expect(removed.statusCode).toBe(204);
      const after = await app.inject({
        method: 'GET',
        url: `/plans/${plan.id}/items`,
        headers: anna.auth,
      });
      expect(after.json()).toEqual([]);
    });

    it('round-trips a match hint through create, update, history, clone and clear (AI-004)', async () => {
      const anna = await register('anna-hint@example.com');
      const plan = await createPlan(anna, monthly('household'));
      const hint = {
        counterpartyPattern: 'Landlord',
        amountMinor: '340000',
        toleranceMinor: '500',
        dayOfMonth: 5,
        dayWindow: 2,
      };

      const created = await app.inject({
        method: 'POST',
        url: `/plans/${plan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: SYSTEM_CATEGORY_ID,
          direction: 'expense',
          amountMinor: '340000',
          currency: 'PLN',
          matchHint: hint,
        },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ matchHint: hint });
      const item = created.json<{ id: string }>();

      const listed = await app.inject({
        method: 'GET',
        url: `/plans/${plan.id}/items`,
        headers: anna.auth,
      });
      expect(listed.json()).toMatchObject([{ id: item.id, matchHint: hint }]);

      const changed = {
        counterpartyPattern: 'Landlord',
        amountMinor: '350000',
        toleranceMinor: '0',
      };
      const updated = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}/items/${item.id}`,
        headers: anna.auth,
        payload: { matchHint: changed },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        matchHint: { ...changed, dayOfMonth: null, dayWindow: null },
      });

      const history = await app.inject({
        method: 'GET',
        url: `/plans/${plan.id}/items/${item.id}/history`,
        headers: anna.auth,
      });
      expect(history.json()).toMatchObject([
        {
          before: { matchHint: hint },
          after: { matchHint: { ...changed, dayOfMonth: null, dayWindow: null } },
        },
      ]);

      const cloned = await app.inject({
        method: 'POST',
        url: `/plans/${plan.id}/clone`,
        headers: anna.auth,
        payload: {},
      });
      const clone = cloned.json<PlanBody>();
      const cloneItems = await app.inject({
        method: 'GET',
        url: `/plans/${clone.id}/items`,
        headers: anna.auth,
      });
      expect(cloneItems.json()).toMatchObject([
        { matchHint: { ...changed, dayOfMonth: null, dayWindow: null } },
      ]);

      const cleared = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}/items/${item.id}`,
        headers: anna.auth,
        payload: { matchHint: null },
      });
      expect(cleared.json()).toMatchObject({ matchHint: null });

      const empty = await app.inject({
        method: 'PATCH',
        url: `/plans/${plan.id}/items/${item.id}`,
        headers: anna.auth,
        payload: { matchHint: { counterpartyPattern: ' ' } },
      });
      expect(empty.statusCode).toBe(400);
    });

    it("rejects another household's items and categories, and bad amounts", async () => {
      const anna = await register('anna-x@example.com');
      const eve = await register('eve-x@example.com');
      const annaPlan = await createPlan(anna, monthly('household'));
      const evePlan = await createPlan(eve, monthly('household'));
      const eveCategory = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: eve.auth,
        payload: { name: 'Eve only' },
      });
      const annaItem = await app.inject({
        method: 'POST',
        url: `/plans/${annaPlan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: SYSTEM_CATEGORY_ID,
          direction: 'income',
          amountMinor: 100,
          currency: 'PLN',
        },
      });
      expect(annaItem.statusCode).toBe(201);
      const itemId = annaItem.json<{ id: string }>().id;

      const foreignCategory = await app.inject({
        method: 'POST',
        url: `/plans/${evePlan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: eveCategory.json<{ id: string }>().id,
          direction: 'expense',
          amountMinor: '1',
          currency: 'PLN',
        },
      });
      expect(foreignCategory.statusCode).toBe(404);

      const wrongCategory = await app.inject({
        method: 'POST',
        url: `/plans/${annaPlan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: eveCategory.json<{ id: string }>().id,
          direction: 'expense',
          amountMinor: '1',
          currency: 'PLN',
        },
      });
      expect(wrongCategory.statusCode).toBe(404);
      expect(wrongCategory.json()).toMatchObject({ code: 'category_not_found' });

      const crossPlan = await app.inject({
        method: 'PATCH',
        url: `/plans/${evePlan.id}/items/${itemId}`,
        headers: eve.auth,
        payload: { note: 'mine now' },
      });
      expect(crossPlan.statusCode).toBe(404);
      expect(crossPlan.json()).toMatchObject({ code: 'planned_item_not_found' });

      const badAmount = await app.inject({
        method: 'POST',
        url: `/plans/${annaPlan.id}/items`,
        headers: anna.auth,
        payload: {
          categoryId: SYSTEM_CATEGORY_ID,
          direction: 'expense',
          amountMinor: '-5',
          currency: 'PLN',
        },
      });
      expect(badAmount.statusCode).toBe(400);

      const halfAmount = await app.inject({
        method: 'PATCH',
        url: `/plans/${annaPlan.id}/items/${itemId}`,
        headers: anna.auth,
        payload: { currency: 'EUR' },
      });
      expect(halfAmount.statusCode).toBe(400);
    });
  });

  describe('categories', () => {
    it('lists system and own categories, creates, renames, sets privacy and archives', async () => {
      const anna = await register('anna-c@example.com');

      const created = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: anna.auth,
        payload: { name: ' Coffee ', color: '#112233' },
      });
      expect(created.statusCode).toBe(201);
      const coffee = created.json<{ id: string }>();
      expect(created.json()).toMatchObject({
        name: 'Coffee',
        kind: 'expense',
        color: '#112233',
        isSystem: false,
        privacy: 'total_only',
        archived: false,
      });

      const list = await app.inject({ method: 'GET', url: '/categories', headers: anna.auth });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toMatchObject([
        { name: 'Coffee', isSystem: false },
        { id: SYSTEM_CATEGORY_ID, name: 'Groceries', isSystem: true, seedKey: 'expense.groceries' },
      ]);

      const patched = await app.inject({
        method: 'PATCH',
        url: `/categories/${coffee.id}`,
        headers: anna.auth,
        payload: { name: 'Cafe', privacy: 'total_only', archived: true },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toMatchObject({ name: 'Cafe', privacy: 'total_only', archived: true });

      const activeOnly = await app.inject({
        method: 'GET',
        url: '/categories',
        headers: anna.auth,
      });
      expect(activeOnly.json<{ id: string }[]>().map((c) => c.id)).toEqual([SYSTEM_CATEGORY_ID]);
      const withArchived = await app.inject({
        method: 'GET',
        url: '/categories?includeArchived=true',
        headers: anna.auth,
      });
      expect(withArchived.json<unknown[]>()).toHaveLength(2);

      const duplicate = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: anna.auth,
        payload: { name: 'groceries' },
      });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json()).toMatchObject({ code: 'category_duplicate' });
    });

    it('keeps system categories read-only and hides other households', async () => {
      const anna = await register('anna-s@example.com');
      const eve = await register('eve-s@example.com');
      const eveCategory = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: eve.auth,
        payload: { name: 'Secret' },
      });

      const system = await app.inject({
        method: 'PATCH',
        url: `/categories/${SYSTEM_CATEGORY_ID}`,
        headers: anna.auth,
        payload: { privacy: 'total_only' },
      });
      expect(system.statusCode).toBe(403);
      expect(system.json()).toMatchObject({ code: 'category_read_only' });

      const foreign = await app.inject({
        method: 'PATCH',
        url: `/categories/${eveCategory.json<{ id: string }>().id}`,
        headers: anna.auth,
        payload: { name: 'Mine' },
      });
      expect(foreign.statusCode).toBe(404);

      const annaList = await app.inject({ method: 'GET', url: '/categories', headers: anna.auth });
      expect(annaList.json<{ name: string }[]>().map((c) => c.name)).toEqual(['Groceries']);

      const invalid = await app.inject({
        method: 'POST',
        url: '/categories',
        headers: anna.auth,
        payload: { name: 'x', kind: 'transfer', color: 'red' },
      });
      expect(invalid.statusCode).toBe(400);
    });
  });

  describe('users/me', () => {
    it('reads and updates the profile and preferences', async () => {
      const anna = await register('anna-u@example.com');

      const me = await app.inject({ method: 'GET', url: '/users/me', headers: anna.auth });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toMatchObject({
        id: anna.userId,
        email: 'anna-u@example.com',
        locale: 'en',
        timezone: 'UTC',
        householdId: anna.householdId,
      });

      const patched = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: anna.auth,
        payload: {
          displayName: 'Anna',
          locale: 'pl',
          baseCurrency: 'EUR',
          timezone: 'Europe/Warsaw',
        },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toEqual({
        id: anna.userId,
        email: 'anna-u@example.com',
        displayName: 'Anna',
        locale: 'pl',
        localePreference: 'pl',
        defaultLocale: 'en',
        baseCurrency: 'EUR',
        timezone: 'Europe/Warsaw',
        householdId: anna.householdId,
      });

      const badZone = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: anna.auth,
        payload: { timezone: 'Mars/Olympus' },
      });
      expect(badZone.statusCode).toBe(400);
      expect(badZone.json()).toMatchObject({ code: 'user_preference_invalid' });

      const unknownField = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        headers: anna.auth,
        payload: { isAdmin: true },
      });
      expect(unknownField.statusCode).toBe(400);
    });
  });

  it('rejects unauthenticated calls', async () => {
    const res = await app.inject({ method: 'GET', url: `/plans/${uuidv7()}` });
    expect(res.statusCode).toBe(401);
  });
});

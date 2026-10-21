import { test, expect } from '@playwright/test';
import { FULL_STACK, STACK } from './support/stack.js';
import { BackendApi, PASSWORD, uniqueEmail } from './support/api.js';
import { assertMatchesSpec } from './support/openapi-contract.js';
import { ApiClient, PlansApi, type SecureTokenStore } from '@power-budget/shared-app';
import type { PlanDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { toPlanDashboard } from '../src/infrastructure/api/PlanDashboardMapper.js';
import { TransactionMapper } from '../src/infrastructure/api/TransactionMapper.js';

// Web <-> backend contract at runtime (CLN-017): real responses from the running
// backend must match openapi.json (which api-types, and so every web DTO and mapper
// input, is generated from); the plan calls go through the shared-app client the
// web screens use, and the web mappers must turn responses into complete view data.
test.skip(!FULL_STACK, 'needs the e2e stack (TEST_ENV=e2e)');

test.describe('web <-> backend contract', () => {
  test('auth, profile and categories responses match the spec', async ({ request }) => {
    const api = new BackendApi(request);
    const email = uniqueEmail('contract-auth');

    const registered = await request.post(`${STACK.apiUrl}/auth/register`, {
      data: { email, password: PASSWORD },
      headers: api.clientIpHeader(),
    });
    const tokens = await api.json<unknown>(registered, 201);
    assertMatchesSpec('post', '/auth/register', 201, tokens);

    const login = await api.login(email);
    assertMatchesSpec('post', '/auth/login', 201, login);

    const me = await api.json<unknown>(await api.get('/users/me', login.accessToken), 200);
    assertMatchesSpec('get', '/users/me', 200, me);

    const categories = await api.json<unknown>(
      await api.get('/categories', login.accessToken),
      200,
    );
    assertMatchesSpec('get', '/categories', 200, categories);
  });

  test('plan, item and dashboard responses match the spec and map to complete view data', async ({
    request,
  }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('contract-plans'));
    const category = await api.expenseCategory(tokens.accessToken);

    // The client the plan screens use (shared-app ApiClient + PlansApi), on the wire.
    const plansApi = new PlansApi(
      new ApiClient(STACK.apiUrl, new FixedTokenStore(tokens.accessToken, tokens.refreshToken)),
    );
    const created = await plansApi.create({
      name: 'Contract plan',
      type: 'personal',
      periodKind: 'monthly',
      periodStart: '2026-10-01',
      baseCurrency: 'PLN',
    });
    assertMatchesSpec('post', '/plans', 201, created);

    const item = await plansApi.createItem(created.id, {
      categoryId: category.id,
      direction: 'expense',
      amountMinor: '9007199254740993',
      currency: 'PLN',
    });
    assertMatchesSpec('post', '/plans/{id}/items', 201, item);

    const plans = await plansApi.list('all');
    assertMatchesSpec('get', '/plans', 200, plans);
    const plan: PlanDto = await plansApi.get(created.id);
    assertMatchesSpec('get', '/plans/{id}', 200, plan);
    const items = await plansApi.listItems(created.id);
    assertMatchesSpec('get', '/plans/{id}/items', 200, items);

    expect(plan).toMatchObject({
      id: created.id,
      name: 'Contract plan',
      periodKind: 'monthly',
      archivedAt: null,
      baseCurrency: 'PLN',
      period: { start: '2026-10-01', end: '2026-10-31' },
    });
    // Money beyond 2^53 stays an exact string on the wire.
    expect(items.map((row) => [row.id, row.categoryId, row.direction, row.amount])).toEqual([
      [item.id, category.id, 'expense', { amountMinor: '9007199254740993', currency: 'PLN' }],
    ]);

    const dashboard = await plansApi.dashboard(created.id);
    assertMatchesSpec('get', '/plans/{id}/dashboard', 200, dashboard);
    const unplanned = await plansApi.unplanned(created.id, 'expense');
    assertMatchesSpec('get', '/plans/{id}/dashboard/unplanned', 200, unplanned);
    expect(unplanned).toEqual({ items: [], nextCursor: null });
    const view = toPlanDashboard(dashboard, {
      plan,
      categoryNames: new Map([[category.id, category.name]]),
      items,
    });
    expect(view).toMatchObject({
      planId: created.id,
      planName: 'Contract plan',
      planType: 'personal',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      baseCurrency: 'PLN',
      income: [],
    });
    expect(view.totals.actualExpenses).toEqual({ amountMinor: 0n, currency: 'PLN' });
    expect(view.totals.unplannedExpenses).toEqual({ amountMinor: 0n, currency: 'PLN' });
    // Minor units stay exact bigints in the view, also beyond 2^53.
    expect(view.expense).toEqual([
      {
        categoryId: category.id,
        categoryName: category.name,
        direction: 'expense',
        planned: { amountMinor: 9007199254740993n, currency: 'PLN' },
        actual: { amountMinor: 0n, currency: 'PLN' },
        remaining: { amountMinor: 9007199254740993n, currency: 'PLN' },
        band: 'ok',
        lines: [
          {
            plannedItemId: item.id,
            direction: 'expense',
            planned: { amountMinor: 9007199254740993n, currency: 'PLN' },
            actual: { amountMinor: 0n, currency: 'PLN' },
            remaining: { amountMinor: 9007199254740993n, currency: 'PLN' },
            band: 'ok',
            original: null,
            note: '',
          },
        ],
      },
    ]);
  });

  test('transaction list responses match the spec and map', async ({ request }) => {
    const api = new BackendApi(request);
    const tokens = await api.register(uniqueEmail('contract-tx'));

    const page = await api.json<TransactionPageDto>(
      await api.get('/transactions?limit=10', tokens.accessToken),
      200,
    );
    assertMatchesSpec('get', '/transactions', 200, page);
    // No manual account can be created yet (see transactions.spec.ts), so the page is empty.
    expect(page.items.map((row) => TransactionMapper.fromListItem(row))).toEqual([]);
  });

  test('household invite, accept and household dashboard responses match the spec', async ({
    request,
  }) => {
    const api = new BackendApi(request);
    const owner = await api.register(uniqueEmail('contract-owner'));
    const partnerEmail = uniqueEmail('contract-partner');

    const invite = await api.json<unknown>(
      await api.post('/households/invites', owner.accessToken, { email: partnerEmail }),
      201,
    );
    assertMatchesSpec('post', '/households/invites', 201, invite);
    const open = await api.json<unknown>(
      await api.get('/households/invites', owner.accessToken),
      200,
    );
    assertMatchesSpec('get', '/households/invites', 200, open);

    const token = await api.inviteToken(partnerEmail);
    const partner = await api.register(partnerEmail);
    const accepted = await api.json<{ householdId: string; accessToken: string }>(
      await api.post('/households/invites/accept', partner.accessToken, { token }),
      200,
    );
    assertMatchesSpec('post', '/households/invites/accept', 200, accepted);

    const plan = await api.createPlan(owner.accessToken, {
      name: 'Household contract',
      type: 'household',
      baseCurrency: 'PLN',
    });
    const dashboard = await api.json<unknown>(
      await api.get(
        `/households/${accepted.householdId}/dashboard?planId=${plan.id}`,
        accepted.accessToken,
      ),
      200,
    );
    assertMatchesSpec('get', '/households/{id}/dashboard', 200, dashboard);

    // UI-013: the household screen lists the members.
    const members = await api.json<Array<{ email: string; role: string }>>(
      await api.get('/households/members', accepted.accessToken),
      200,
    );
    assertMatchesSpec('get', '/households/members', 200, members);
    expect(members.map(({ role }) => role)).toEqual(['owner', 'member']);
  });
});

/** Hands fixed tokens to the shared-app ApiClient (no refresh needed in one test). */
class FixedTokenStore implements SecureTokenStore {
  constructor(
    private readonly accessToken: string,
    private readonly refreshToken: string,
  ) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  async setTokens(): Promise<void> {}

  async clearTokens(): Promise<void> {}
}

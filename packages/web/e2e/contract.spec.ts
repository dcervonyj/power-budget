import { test, expect } from '@playwright/test';
import { FULL_STACK, STACK } from './support/stack.js';
import { BackendApi, PASSWORD, uniqueEmail } from './support/api.js';
import { assertMatchesSpec } from './support/openapi-contract.js';
import {
  PlanMapper,
  type PlanDto,
  type PlannedItemDto,
} from '../src/infrastructure/api/PlanMapper.js';
import {
  toPlanActualsView,
  type PlanDashboardResponseDto,
} from '../src/infrastructure/api/PlanDashboardMapper.js';
import {
  TransactionMapper,
  type TransactionPageDto,
} from '../src/infrastructure/api/TransactionMapper.js';

// Web <-> backend contract at runtime (CLN-017): real responses from the running
// backend must match openapi.json (which api-types, and so every web mapper input,
// is generated from), and the web mappers must turn them into complete view data.
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

    const createdRes = await api.post('/plans', tokens.accessToken, {
      name: 'Contract plan',
      type: 'personal',
      periodKind: 'monthly',
      periodStart: '2026-10-01',
      baseCurrency: 'PLN',
    });
    const created = await api.json<PlanDto>(createdRes, 201);
    assertMatchesSpec('post', '/plans', 201, created);

    const itemRes = await api.post(`/plans/${created.id}/items`, tokens.accessToken, {
      categoryId: category.id,
      direction: 'expense',
      amountMinor: '9007199254740993',
      currency: 'PLN',
    });
    const item = await api.json<PlannedItemDto>(itemRes, 201);
    assertMatchesSpec('post', '/plans/{id}/items', 201, item);

    const plans = await api.json<PlanDto[]>(await api.get('/plans', tokens.accessToken), 200);
    assertMatchesSpec('get', '/plans', 200, plans);
    const plan = await api.json<PlanDto>(
      await api.get(`/plans/${created.id}`, tokens.accessToken),
      200,
    );
    assertMatchesSpec('get', '/plans/{id}', 200, plan);
    const items = await api.json<PlannedItemDto[]>(
      await api.get(`/plans/${created.id}/items`, tokens.accessToken),
      200,
    );
    assertMatchesSpec('get', '/plans/{id}/items', 200, items);

    // PlanMapper: the plan screens' view of the same rows.
    expect(PlanMapper.toPlan(plan)).toEqual({
      id: created.id,
      name: 'Contract plan',
      period: 'monthly',
      status: 'active',
      baseCurrency: 'PLN',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      updatedAt: plan.updatedAt,
    });
    // Money beyond 2^53 stays an exact string through the wire and the mapper.
    expect(items.map((row) => PlanMapper.toItem(row))).toEqual([
      {
        id: item.id,
        planId: created.id,
        categoryId: category.id,
        direction: 'expense',
        amountMinor: '9007199254740993',
        currency: 'PLN',
      },
    ]);

    const dashboard = await api.json<PlanDashboardResponseDto>(
      await api.get(`/plans/${created.id}/dashboard`, tokens.accessToken),
      200,
    );
    assertMatchesSpec('get', '/plans/{id}/dashboard', 200, dashboard);
    const view = toPlanActualsView(dashboard, {
      planName: plan.name,
      categoryNames: new Map([[category.id, category.name]]),
    });
    expect(view).toMatchObject({
      planId: created.id,
      planName: 'Contract plan',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      currency: 'PLN',
      totalExpenseActual: 0,
      unplannedTotal: 0,
    });
    // Minor units become numbers in the view (exact below 2^53, see the mapper).
    expect(view.items).toEqual([
      {
        id: item.id,
        category: category.name,
        direction: 'expense',
        planned: Number(9007199254740993n),
        actual: 0,
        currency: 'PLN',
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
    expect(page.items.map((row) => TransactionMapper.fromListItem(row, false))).toEqual([]);
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
  });
});

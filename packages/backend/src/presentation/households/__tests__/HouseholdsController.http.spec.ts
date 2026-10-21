import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  CategoryAggregate,
  CategoryId,
  HouseholdId,
  PlanId,
  UserId,
} from '@power-budget/core';
import { HouseholdsController } from '../HouseholdsController.js';
import { GetHouseholdDashboardUseCase } from '../../../application/households/use-cases/GetHouseholdDashboardUseCase.js';
import {
  bearerFor,
  createHttpTestApp,
  type HttpTestApp,
} from '../../../test/http/createHttpTestApp.js';

const ALICE = '01900000-0000-7000-8000-00000000000a' as UserId;
const ALICE_HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;
const BOB_HOUSEHOLD = '01900000-0000-7000-8000-0000000000b1' as HouseholdId;
const PLAN = '01900000-0000-7000-8000-0000000000c1' as PlanId;
const CATEGORY = '01900000-0000-7000-8000-0000000000f1' as CategoryId;

describe('GET /households/:id/dashboard (HTTP)', () => {
  let app: HttpTestApp;
  let dashboard: ReturnType<typeof mock<GetHouseholdDashboardUseCase>>;

  beforeEach(async () => {
    dashboard = mock<GetHouseholdDashboardUseCase>();
    dashboard.execute.mockResolvedValue({ categories: [] });
    app = await createHttpTestApp({
      controllers: [HouseholdsController],
      providers: [{ provide: GetHouseholdDashboardUseCase, useValue: dashboard }],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 404 for another household's dashboard and never reads it", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/households/${BOB_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
    expect(dashboard.execute).not.toHaveBeenCalled();
  });

  it("returns the caller's own household dashboard", async () => {
    const before = Date.now();
    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ planId: PLAN, categories: [] });
    const [input] = dashboard.execute.mock.calls[0]!;
    expect(input).toEqual({
      householdId: ALICE_HOUSEHOLD,
      planId: PLAN,
      viewerUserId: ALICE,
      asOf: input.asOf,
    });
    expect(input.asOf.getTime()).toBeGreaterThanOrEqual(before);
    expect(input.asOf.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('returns money as string minor units, even beyond Number.MAX_SAFE_INTEGER', async () => {
    const groceries: CategoryAggregate = {
      categoryId: CATEGORY,
      category: mock<CategoryAggregate['category']>({ name: 'Groceries' }),
      totalAmount: { amountMinor: 9007199254740993n, currency: 'PLN' },
      transactionCount: 3,
      privacyLevel: 'total_with_counts',
    };
    dashboard.execute.mockResolvedValue({ categories: [groceries] });

    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      planId: PLAN,
      categories: [
        {
          categoryId: CATEGORY,
          categoryName: 'Groceries',
          privacyLevel: 'total_with_counts',
          totalAmountMinor: '9007199254740993',
          currency: 'PLN',
          transactionCount: 3,
        },
      ],
    });
  });

  it('maps a domain error to its status and keeps the code', async () => {
    dashboard.execute.mockRejectedValue(
      new Error(`PLAN_NOT_FOUND: Plan ${PLAN} not found in household ${ALICE_HOUSEHOLD}`),
    );

    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      statusCode: 404,
      code: 'plan_not_found',
      message: 'Plan not found',
    });
  });

  it('rejects a planId that is not a UUID with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=not-a-uuid`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ statusCode: 400, code: 'bad_request' });
    expect(dashboard.execute).not.toHaveBeenCalled();
  });

  it('answers 500 without internals for an unexpected error', async () => {
    dashboard.execute.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      statusCode: 500,
      code: 'internal_server_error',
      message: 'Internal server error',
    });
  });

  it('returns 401 without a bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

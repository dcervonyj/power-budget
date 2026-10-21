import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, PlanId, UserId } from '@power-budget/core';
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
    const res = await app.inject({
      method: 'GET',
      url: `/households/${ALICE_HOUSEHOLD}/dashboard?planId=${PLAN}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ planId: PLAN, categories: [] });
    expect(dashboard.execute).toHaveBeenCalledWith({
      householdId: ALICE_HOUSEHOLD,
      planId: PLAN,
      viewerUserId: ALICE,
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

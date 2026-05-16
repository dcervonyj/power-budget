import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { HouseholdId, UserId, PlanId } from '@power-budget/core';
import { PlansController } from '../PlansController.js';
import { GetPlanDashboardUseCase } from '../../application/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../../application/use-cases/GetUnplannedTransactionsUseCase.js';
import type { AuthenticatedUser } from '../../../auth/presentation/decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;
const TEST_PLAN_ID = '01900000-0000-7000-8000-000000000003' as PlanId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('PlansController', () => {
  let controller: PlansController;
  let getDashboard: ReturnType<typeof mock<GetPlanDashboardUseCase>>;
  let getUnplanned: ReturnType<typeof mock<GetUnplannedTransactionsUseCase>>;

  beforeEach(() => {
    getDashboard = mock<GetPlanDashboardUseCase>();
    getUnplanned = mock<GetUnplannedTransactionsUseCase>();
    controller = new PlansController(getDashboard, getUnplanned);
  });

  describe('GET /plans/:id/dashboard', () => {
    it('calls GetPlanDashboardUseCase with planId and householdId', async () => {
      const dashboardData = { planId: TEST_PLAN_ID, items: [] };
      getDashboard.execute.mockResolvedValue(dashboardData as never);

      const result = await controller.dashboard(TEST_PLAN_ID, makeUser());

      expect(getDashboard.execute).toHaveBeenCalledWith(
        expect.objectContaining({ planId: TEST_PLAN_ID, householdId: TEST_HOUSEHOLD_ID }),
      );
      expect(result).toEqual(dashboardData);
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(controller.dashboard(TEST_PLAN_ID, makeUser(null))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when plan not found', async () => {
      getDashboard.execute.mockRejectedValue(new Error('PLAN_NOT_FOUND: plan-1'));
      await expect(controller.dashboard(TEST_PLAN_ID, makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /plans/:id/dashboard/unplanned', () => {
    it('calls GetUnplannedTransactionsUseCase and maps items', async () => {
      getUnplanned.execute.mockResolvedValue({
        items: [
          {
            id: 'tx-1',
            description: 'Coffee',
            amountMinor: 500n,
            currency: 'PLN',
            occurredOn: '2024-01-15',
            accountId: 'acc-1',
            source: 'gocardless',
          },
        ],
        nextCursor: null,
      } as never);

      const result = await controller.unplanned(
        TEST_PLAN_ID,
        'expense',
        undefined,
        undefined,
        makeUser(),
      );

      expect(getUnplanned.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: TEST_PLAN_ID,
          householdId: TEST_HOUSEHOLD_ID,
          direction: 'expense',
        }),
      );
      expect(result.items[0]).toEqual(expect.objectContaining({ id: 'tx-1', amountMinor: 500 }));
    });

    it('forwards cursor and limit params', async () => {
      getUnplanned.execute.mockResolvedValue({ items: [], nextCursor: null } as never);

      await controller.unplanned(TEST_PLAN_ID, 'income', 'cursor-1', '25', makeUser());

      expect(getUnplanned.execute).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'cursor-1', limit: 25 }),
      );
    });

    it('throws BadRequestException for invalid direction', async () => {
      await expect(
        controller.unplanned(TEST_PLAN_ID, 'invalid', undefined, undefined, makeUser()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(
        controller.unplanned(TEST_PLAN_ID, 'expense', undefined, undefined, makeUser(null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

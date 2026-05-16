import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { HouseholdId, UserId, PlanId } from '@power-budget/core';
import { HouseholdsController } from '../HouseholdsController.js';
import { GetHouseholdDashboardUseCase } from '../../application/use-cases/GetHouseholdDashboardUseCase.js';
import type { AuthenticatedUser } from '../../../auth/presentation/decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;
const TEST_PLAN_ID = '01900000-0000-7000-8000-000000000003' as PlanId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('HouseholdsController (households domain)', () => {
  let controller: HouseholdsController;
  let getHouseholdDashboard: ReturnType<typeof mock<GetHouseholdDashboardUseCase>>;

  beforeEach(() => {
    getHouseholdDashboard = mock<GetHouseholdDashboardUseCase>();
    controller = new HouseholdsController(getHouseholdDashboard);
  });

  describe('GET /households/:id/dashboard', () => {
    it('calls GetHouseholdDashboardUseCase with householdId, planId, viewerUserId', async () => {
      getHouseholdDashboard.execute.mockResolvedValue({ categories: [] } as never);

      await controller.dashboard(TEST_HOUSEHOLD_ID, TEST_PLAN_ID, makeUser());

      expect(getHouseholdDashboard.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: TEST_HOUSEHOLD_ID,
          planId: TEST_PLAN_ID,
          viewerUserId: TEST_USER_ID,
        }),
      );
    });

    it('maps categories to DTO shape', async () => {
      getHouseholdDashboard.execute.mockResolvedValue({
        categories: [
          {
            categoryId: 'cat-1',
            category: { name: 'Groceries' },
            privacyLevel: 'shared',
            totalAmount: { amountMinor: 15000n, currency: 'PLN' },
            transactionCount: 3,
          },
        ],
      } as never);

      const result = await controller.dashboard(TEST_HOUSEHOLD_ID, TEST_PLAN_ID, makeUser());

      expect(result.categories[0]).toEqual({
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        privacyLevel: 'shared',
        totalAmountMinor: 15000,
        currency: 'PLN',
        transactionCount: 3,
      });
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(
        controller.dashboard(TEST_HOUSEHOLD_ID, TEST_PLAN_ID, makeUser(null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when plan not found', async () => {
      getHouseholdDashboard.execute.mockRejectedValue(new Error('PLAN_NOT_FOUND: plan-1'));
      await expect(
        controller.dashboard(TEST_HOUSEHOLD_ID, TEST_PLAN_ID, makeUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

import type { PlanId, HouseholdId, UserId } from '@power-budget/core';

export interface GetHouseholdDashboardInput {
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
  readonly viewerUserId: UserId;
}

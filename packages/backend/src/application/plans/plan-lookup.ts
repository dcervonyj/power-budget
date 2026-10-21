import type { HouseholdId, PlanId, PlannedItemId, UserId } from '@power-budget/core';
import type { Plan, PlannedItem } from '../../domain/plans/entities.js';
import type { PlanRepository, PlannedItemRepository } from '../../domain/plans/ports.js';
import { PlanAccess } from '../../domain/plans/plan-access.js';

export interface PlanLookup {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

/**
 * Loads a plan the user may see. Another household's plan and a partner's
 * personal plan both throw PLAN_NOT_FOUND, so their existence is not revealed.
 */
export async function findVisiblePlan(planRepo: PlanRepository, lookup: PlanLookup): Promise<Plan> {
  const plan = await planRepo.findById(lookup.planId, { householdId: lookup.householdId });
  if (plan === null || !PlanAccess.isVisibleTo(plan, lookup.userId)) {
    throw new Error(`PLAN_NOT_FOUND: Plan ${lookup.planId} not found`);
  }

  return plan;
}

/** Loads a planned item of the given plan, or throws PLANNED_ITEM_NOT_FOUND. */
export async function findPlannedItemOfPlan(
  itemRepo: PlannedItemRepository,
  plan: Plan,
  itemId: PlannedItemId,
): Promise<PlannedItem> {
  const item = await itemRepo.findById(itemId, { householdId: plan.householdId });
  if (item === null || item.planId !== plan.id) {
    throw new Error(`PLANNED_ITEM_NOT_FOUND: Planned item ${itemId} not found`);
  }

  return item;
}

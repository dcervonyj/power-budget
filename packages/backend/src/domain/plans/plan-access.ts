import type { UserId } from '@power-budget/core';
import type { Plan } from './entities.js';

/** Who may see and change a plan inside a household. */
export const PlanAccess = {
  /** Household plans are shared; personal plans are visible to their owner only. */
  isVisibleTo(plan: Plan, userId: UserId): boolean {
    return plan.type === 'household' || plan.ownerUserId === userId;
  },

  /** Archived plans are read-only. Throws PLAN_ARCHIVED. */
  assertNotArchived(plan: Plan): void {
    if (plan.archivedAt !== null) {
      throw new Error(`PLAN_ARCHIVED: Plan ${plan.id} is archived`);
    }
  },
};

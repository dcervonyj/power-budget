import { IsoDate } from '@power-budget/core';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { WeeklyDigestSummary } from '../../domain/notifications/entities.js';
import type { WeeklyDigestSummaryReader } from '../../domain/notifications/ports.js';
import type { Plan } from '../../domain/plans/entities.js';
import type { PlanActualsReader, PlanRepository } from '../../domain/plans/ports.js';

/**
 * Digest numbers from the recipient's active plan: a household plan wins over
 * a personal one. Spent and planned are the plan's expense totals so far.
 */
export class PlanActualsWeeklyDigestSummaryReader implements WeeklyDigestSummaryReader {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actualsReader: PlanActualsReader,
  ) {}

  async read(
    member: { readonly householdId: HouseholdId; readonly userId: UserId },
    at: Date,
  ): Promise<WeeklyDigestSummary | null> {
    const day = IsoDate.of(at.toISOString().slice(0, 10));
    const plans = await this.planRepo.list({
      householdId: member.householdId,
      viewerUserId: member.userId,
      status: 'active',
      overlapping: { start: day, end: day },
    });
    const plan = this.pickPlan(plans, member.userId);
    if (plan === undefined) {
      return null;
    }
    const view = await this.actualsReader.read(plan.id, at);

    return {
      planName: plan.name,
      totalSpent: view.totalActualExpenses,
      totalPlanned: view.totalPlannedExpenses,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
    };
  }

  /** Defence in depth: list() already hides archived plans and other members' personal plans. */
  private pickPlan(plans: readonly Plan[], userId: UserId): Plan | undefined {
    const live = plans.filter(isNotArchived);

    return live.find(isHouseholdPlan) ?? live.find(isOwnedBy(userId));
  }
}

function isNotArchived(plan: Plan): boolean {
  return plan.archivedAt === null;
}

function isHouseholdPlan(plan: Plan): boolean {
  return plan.type === 'household';
}

function isOwnedBy(userId: UserId): (plan: Plan) => boolean {
  return function ownedBy(plan: Plan): boolean {
    return plan.type === 'personal' && plan.ownerUserId === userId;
  };
}

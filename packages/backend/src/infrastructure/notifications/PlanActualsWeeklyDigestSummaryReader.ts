import { IsoDate } from '@power-budget/core';
import type { HouseholdId, PlanActualsView, PlanId, UserId } from '@power-budget/core';
import type { WeeklyDigestSummary } from '../../domain/notifications/entities.js';
import type {
  WeeklyDigestRun,
  WeeklyDigestSummaryReader,
} from '../../domain/notifications/ports.js';
import type { Plan } from '../../domain/plans/entities.js';
import type { PlanActualsReader, PlanRepository } from '../../domain/plans/ports.js';

/** Hands out a reader whose caches live for one cron run. */
export interface RunScopedPlanActuals {
  runScoped(): PlanActualsReader;
}

/**
 * Digest numbers from the recipient's active plan: a household plan wins over
 * a personal one. Spent and planned are the plan's expense totals so far.
 */
export class PlanActualsWeeklyDigestSummaryReader implements WeeklyDigestSummaryReader {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actuals: RunScopedPlanActuals,
  ) {}

  startRun(at: Date): WeeklyDigestRun {
    return new PlanActualsDigestRun(this.planRepo, this.actuals.runScoped(), at);
  }
}

class PlanActualsDigestRun implements WeeklyDigestRun {
  private readonly views = new Map<PlanId, Promise<PlanActualsView>>();

  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actualsReader: PlanActualsReader,
    private readonly at: Date,
  ) {}

  async read(member: {
    readonly householdId: HouseholdId;
    readonly userId: UserId;
  }): Promise<WeeklyDigestSummary | null> {
    const day = IsoDate.of(this.at.toISOString().slice(0, 10));
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
    const view = await this.viewOf(plan);

    return {
      planName: plan.name,
      totalSpent: view.totalActualExpenses,
      totalPlanned: view.totalPlannedExpenses,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
    };
  }

  /** Members of one household share the plan, so its numbers are computed once per run. */
  private viewOf(plan: Plan): Promise<PlanActualsView> {
    const cached = this.views.get(plan.id);
    if (cached !== undefined) {
      return cached;
    }
    const computed = this.actualsReader.read(plan, this.at);
    this.views.set(plan.id, computed);

    return computed;
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

import type { PlanId, UserId, HouseholdId, IsoDate } from '@power-budget/core';
import type { Plan, PlanPeriod } from '../../../domain/plans/entities.js';
import type { PlanRepository, AuditLogPort, PlanPatch } from '../../../domain/plans/ports.js';
import { PlanAccess } from '../../../domain/plans/plan-access.js';
import { PlanCloning, PlanPeriods } from '../../../domain/plans/plan-cloning.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface UpdatePlanPatch {
  readonly name?: string;
  readonly periodStart?: IsoDate;
  readonly periodEnd?: IsoDate;
  readonly baseCurrency?: string;
}

export interface UpdatePlanInput {
  readonly planId: PlanId;
  readonly patch: UpdatePlanPatch;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class UpdatePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdatePlanInput): Promise<Plan> {
    const existing = await findVisiblePlan(this.planRepo, input);
    PlanAccess.assertNotArchived(existing);

    const period = this.resolvePeriod(existing, input.patch);
    if (period !== undefined) {
      await this.assertNoOverlap(existing, period, input.userId);
    }

    const patch: PlanPatch = {
      ...(input.patch.name !== undefined ? { name: input.patch.name } : {}),
      ...(input.patch.baseCurrency !== undefined ? { baseCurrency: input.patch.baseCurrency } : {}),
      ...(period !== undefined ? { period } : {}),
    };
    const updated = await this.planRepo.update(input.planId, patch, {
      householdId: input.householdId,
    });

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_UPDATED',
      subjectType: 'Plan',
      subjectId: updated.id,
    });

    return updated;
  }

  /**
   * A new start on a weekly or monthly plan moves the whole period (the end is
   * derived again); a custom plan keeps its end unless a new one is given.
   */
  private resolvePeriod(plan: Plan, patch: UpdatePlanPatch): PlanPeriod | undefined {
    if (patch.periodStart === undefined && patch.periodEnd === undefined) {
      return undefined;
    }
    const start = patch.periodStart ?? plan.period.start;
    const keepEnd = patch.periodStart === undefined || plan.periodKind === 'custom';
    const end = patch.periodEnd ?? (keepEnd ? plan.period.end : undefined);

    return PlanPeriods.resolve(plan.periodKind, start, end);
  }

  private async assertNoOverlap(plan: Plan, period: PlanPeriod, userId: UserId): Promise<void> {
    const overlapping = await this.planRepo.list({
      householdId: plan.householdId,
      viewerUserId: userId,
      status: 'active',
      overlapping: period,
    });
    PlanCloning.assertNoDuplicateActivePlan(overlapping, {
      id: plan.id,
      type: plan.type,
      periodKind: plan.periodKind,
      period,
      ownerUserId: plan.ownerUserId,
    });
  }
}

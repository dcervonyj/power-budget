import type { PlanId, UserId, HouseholdId } from '@power-budget/core';
import type { PlanRepository, AuditLogPort } from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface ArchivePlanInput {
  readonly planId: PlanId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class ArchivePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Idempotent: archiving an archived plan changes nothing. */
  async execute(input: ArchivePlanInput): Promise<void> {
    const existing = await findVisiblePlan(this.planRepo, input);
    if (existing.archivedAt !== null) {
      return;
    }

    await this.planRepo.archive(input.planId, this.now(), { householdId: input.householdId });

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_ARCHIVED',
      subjectType: 'Plan',
      subjectId: input.planId,
    });
  }
}

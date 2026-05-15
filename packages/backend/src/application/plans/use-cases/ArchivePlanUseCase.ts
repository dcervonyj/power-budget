import type { PlanId, UserId, HouseholdId } from '@power-budget/core';
import type { PlanRepository, AuditLogPort, HouseholdScope } from '../../../domain/plans/ports.js';

export interface ArchivePlanInput {
  readonly planId: PlanId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class ArchivePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: ArchivePlanInput): Promise<void> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const existing = await this.planRepo.findById(input.planId, scope);
    if (existing === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    await this.planRepo.archive(input.planId, new Date());

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_ARCHIVED',
      subjectType: 'Plan',
      subjectId: input.planId,
    });
  }
}

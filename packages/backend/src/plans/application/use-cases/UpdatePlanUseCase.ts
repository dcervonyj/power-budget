import type { PlanId, UserId, HouseholdId } from '@power-budget/core';
import type { Plan } from '../../domain/entities.js';
import type { PlanRepository, AuditLogPort, HouseholdScope } from '../../domain/ports.js';

export interface UpdatePlanInput {
  readonly planId: PlanId;
  readonly patch: { readonly name?: string };
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class UpdatePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdatePlanInput): Promise<Plan> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const existing = await this.planRepo.findById(input.planId, scope);
    if (existing === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    const updated = await this.planRepo.update(input.planId, input.patch, scope);

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_UPDATED',
      subjectType: 'Plan',
      subjectId: updated.id,
    });

    return updated;
  }
}

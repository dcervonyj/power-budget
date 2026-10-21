import type { PlanId, PlannedItemId, HouseholdId, UserId } from '@power-budget/core';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import { PlanAccess } from '../../../domain/plans/plan-access.js';
import { findPlannedItemOfPlan, findVisiblePlan } from '../plan-lookup.js';

export interface RemovePlannedItemInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class RemovePlannedItemUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: RemovePlannedItemInput): Promise<void> {
    const plan = await findVisiblePlan(this.planRepo, input);
    PlanAccess.assertNotArchived(plan);
    await findPlannedItemOfPlan(this.plannedItemRepo, plan, input.itemId);

    await this.plannedItemRepo.remove(input.itemId, { householdId: input.householdId });

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLANNED_ITEM_REMOVED',
      subjectType: 'PlannedItem',
      subjectId: input.itemId,
    });
  }
}

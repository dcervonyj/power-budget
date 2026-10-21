import type { PlanId, PlannedItemId, UserId, HouseholdId } from '@power-budget/core';
import type { PlannedItem, PlannedItemPatch } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import { PlanAccess } from '../../../domain/plans/plan-access.js';
import { findPlannedItemOfPlan, findVisiblePlan } from '../plan-lookup.js';

export interface UpdatePlannedItemInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly patch: PlannedItemPatch;
  readonly reason?: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class UpdatePlannedItemUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdatePlannedItemInput): Promise<PlannedItem> {
    const plan = await findVisiblePlan(this.planRepo, input);
    PlanAccess.assertNotArchived(plan);
    await findPlannedItemOfPlan(this.plannedItemRepo, plan, input.itemId);

    const updated = await this.plannedItemRepo.update(
      input.itemId,
      input.patch,
      input.userId,
      { householdId: input.householdId },
      input.reason,
    );

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLANNED_ITEM_UPDATED',
      subjectType: 'PlannedItem',
      subjectId: input.itemId,
    });

    return updated;
  }
}

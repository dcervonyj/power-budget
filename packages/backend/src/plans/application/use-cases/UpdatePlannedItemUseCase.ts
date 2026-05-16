import type { PlanId, PlannedItemId, UserId, HouseholdId } from '@power-budget/core';
import type { PlannedItem, PlannedItemPatch } from '../../domain/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
  HouseholdScope,
} from '../../domain/ports.js';

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
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    const updated = await this.plannedItemRepo.update(
      input.itemId,
      input.patch,
      input.userId,
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

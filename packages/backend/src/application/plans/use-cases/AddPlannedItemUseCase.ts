import { PlannedItemId } from '@power-budget/core';
import type { PlanId, UserId, HouseholdId, Money, CategoryId } from '@power-budget/core';
import type {
  PlannedItem,
  NewPlannedItem,
  PlannedDirection,
} from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import type { CategoryRepository } from '../../../domain/categories/ports.js';
import { PlanAccess } from '../../../domain/plans/plan-access.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface AddPlannedItemInput {
  readonly planId: PlanId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly note?: string | null;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class AddPlannedItemUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly auditLog: AuditLogPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: AddPlannedItemInput): Promise<PlannedItem> {
    const scope = { householdId: input.householdId };
    const plan = await findVisiblePlan(this.planRepo, input);
    PlanAccess.assertNotArchived(plan);

    // System categories and the household's own active categories only.
    const category = await this.categoryRepo.findById(input.categoryId, scope);
    if (category === null || category.archivedAt !== null) {
      throw new Error(`CATEGORY_NOT_FOUND: Category ${input.categoryId} not found`);
    }

    const newItem: NewPlannedItem = {
      id: PlannedItemId.of(this.generateId()),
      planId: plan.id,
      householdId: input.householdId,
      categoryId: input.categoryId,
      direction: input.direction,
      amount: input.amount,
      note: input.note ?? null,
    };
    const created = await this.plannedItemRepo.add(newItem);

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLANNED_ITEM_ADDED',
      subjectType: 'PlannedItem',
      subjectId: created.id,
    });

    return created;
  }
}

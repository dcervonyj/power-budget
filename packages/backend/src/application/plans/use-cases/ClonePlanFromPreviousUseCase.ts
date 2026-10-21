import { PlanId, PlannedItemId } from '@power-budget/core';
import type { IsoDate, UserId, HouseholdId } from '@power-budget/core';
import type { Plan, NewPlan, NewPlannedItem, PlannedItem } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import { PlanCloning, PlanPeriods } from '../../../domain/plans/plan-cloning.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface ClonePlanFromPreviousInput {
  readonly sourcePlanId: PlanId;
  readonly name?: string;
  /** Defaults to the next contiguous period of the source plan. */
  readonly periodStart?: IsoDate;
  readonly periodEnd?: IsoDate;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

export class ClonePlanFromPreviousUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly auditLog: AuditLogPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: ClonePlanFromPreviousInput): Promise<Plan> {
    const source = await findVisiblePlan(this.planRepo, {
      planId: input.sourcePlanId,
      householdId: input.householdId,
      userId: input.userId,
    });

    const overridePeriod =
      input.periodStart !== undefined
        ? PlanPeriods.resolve(source.periodKind, input.periodStart, input.periodEnd)
        : undefined;
    const cloneBase = PlanCloning.buildClone(source, PlanId.of(this.generateId()), overridePeriod);
    const newPlanData: NewPlan =
      input.name !== undefined ? { ...cloneBase, name: input.name } : cloneBase;

    const overlapping = await this.planRepo.list({
      householdId: input.householdId,
      viewerUserId: input.userId,
      status: 'active',
      overlapping: newPlanData.period,
    });
    PlanCloning.assertNoDuplicateActivePlan(overlapping, newPlanData);

    const newPlan = await this.planRepo.create(newPlanData);
    const items = await this.plannedItemRepo.listByPlan(source.id, {
      householdId: input.householdId,
    });
    for (const item of items) {
      await this.plannedItemRepo.add(this.cloneItem(item, newPlan));
    }

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_CLONED',
      subjectType: 'Plan',
      subjectId: newPlan.id,
    });

    return newPlan;
  }

  private cloneItem(item: PlannedItem, newPlan: Plan): NewPlannedItem {
    return {
      id: PlannedItemId.of(this.generateId()),
      planId: newPlan.id,
      householdId: newPlan.householdId,
      categoryId: item.categoryId,
      direction: item.direction,
      amount: item.amount,
      note: item.note,
    };
  }
}

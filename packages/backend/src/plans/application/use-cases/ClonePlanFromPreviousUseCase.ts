import { PlanId, PlannedItemId } from '@power-budget/core';
import type { IsoDate, UserId, HouseholdId } from '@power-budget/core';
import type { Plan, NewPlan, NewPlannedItem } from '../../domain/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
  HouseholdScope,
} from '../../domain/ports.js';
import { PlanCloning } from '../../domain/plan-cloning.js';
import type { ClonePlanFromPreviousInput } from '../models/index.js';
export type { ClonePlanFromPreviousInput };

export class ClonePlanFromPreviousUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly auditLog: AuditLogPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: ClonePlanFromPreviousInput): Promise<Plan> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const source = await this.planRepo.findById(input.sourcePlanId, scope);
    if (source === null) {
      throw new Error(`PLAN_NOT_FOUND: Source plan ${input.sourcePlanId} not found`);
    }

    const overridePeriod = this.buildOverridePeriod(input.periodStart, input.periodEnd);
    const cloneBase = PlanCloning.buildClone(source, PlanId.of(this.generateId()), overridePeriod);
    const newPlanData: NewPlan =
      input.name !== undefined ? { ...cloneBase, name: input.name } : cloneBase;

    const newPlan = await this.planRepo.create(newPlanData);

    await this.cloneItems(input.sourcePlanId, newPlan.id, input.householdId);

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_CLONED',
      subjectType: 'Plan',
      subjectId: newPlan.id,
    });

    return newPlan;
  }

  private buildOverridePeriod(
    start: IsoDate | undefined,
    end: IsoDate | undefined,
  ): { start: IsoDate; end: IsoDate } | undefined {
    if (start !== undefined && end !== undefined) {
      return { start, end };
    }

    return undefined;
  }

  private async cloneItems(
    sourcePlanId: PlanId,
    newPlanId: PlanId,
    householdId: HouseholdId,
  ): Promise<void> {
    const items = await this.plannedItemRepo.listByPlan(sourcePlanId);

    const additions = items.map(
      (item): NewPlannedItem => ({
        id: PlannedItemId.of(this.generateId()),
        planId: newPlanId,
        householdId,
        categoryId: item.categoryId,
        direction: item.direction,
        amount: item.amount,
        note: item.note,
      }),
    );

    await Promise.all(additions.map((item) => this.plannedItemRepo.add(item)));
  }
}

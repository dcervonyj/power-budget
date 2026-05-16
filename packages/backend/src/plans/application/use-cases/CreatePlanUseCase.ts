import { PlanId } from '@power-budget/core';
import type { IsoDate, UserId, HouseholdId } from '@power-budget/core';
import type { Plan, NewPlan, PlanType, PlanPeriodKind } from '../../domain/entities.js';
import type { PlanRepository, AuditLogPort } from '../../domain/ports.js';
import { PlanCloning } from '../../domain/plan-cloning.js';
import type { CreatePlanInput } from '../models/index.js';
export type { CreatePlanInput };

export class CreatePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: CreatePlanInput): Promise<Plan> {
    const activePlans = await this.planRepo.listActive({
      userId: input.userId,
      householdId: input.householdId,
      date: new Date(),
    });

    PlanCloning.assertNoDuplicateActivePlan(activePlans, {
      type: input.type,
      periodKind: input.periodKind,
    });

    const newPlan: NewPlan = {
      id: PlanId.of(this.generateId()),
      householdId: input.householdId,
      ownerUserId: input.type === 'personal' ? input.userId : null,
      name: input.name,
      type: input.type,
      periodKind: input.periodKind,
      period: { start: input.periodStart, end: input.periodEnd },
      baseCurrency: input.baseCurrency,
    };

    const created = await this.planRepo.create(newPlan);

    await this.auditLog.record({
      householdId: input.householdId,
      actorUserId: input.userId,
      action: 'PLAN_CREATED',
      subjectType: 'Plan',
      subjectId: created.id,
    });

    return created;
  }
}

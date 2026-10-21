import { PlanId } from '@power-budget/core';
import type { IsoDate, UserId, HouseholdId } from '@power-budget/core';
import type { Plan, NewPlan, PlanType, PlanPeriodKind } from '../../../domain/plans/entities.js';
import type { PlanRepository, AuditLogPort } from '../../../domain/plans/ports.js';
import { PlanCloning, PlanPeriods } from '../../../domain/plans/plan-cloning.js';

export interface CreatePlanInput {
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly periodStart: IsoDate;
  /** Optional for weekly and monthly plans (derived from the start). */
  readonly periodEnd?: IsoDate;
  readonly baseCurrency: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class CreatePlanUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly auditLog: AuditLogPort,
    private readonly generateId: () => string,
  ) {}

  async execute(input: CreatePlanInput): Promise<Plan> {
    const period = PlanPeriods.resolve(input.periodKind, input.periodStart, input.periodEnd);
    const ownerUserId = input.type === 'personal' ? input.userId : null;

    // Audit M13: compare with the plans overlapping the new period, not with "today".
    const overlapping = await this.planRepo.list({
      householdId: input.householdId,
      viewerUserId: input.userId,
      status: 'active',
      overlapping: period,
    });
    PlanCloning.assertNoDuplicateActivePlan(overlapping, {
      type: input.type,
      periodKind: input.periodKind,
      period,
      ownerUserId,
    });

    const newPlan: NewPlan = {
      id: PlanId.of(this.generateId()),
      householdId: input.householdId,
      ownerUserId,
      name: input.name,
      type: input.type,
      periodKind: input.periodKind,
      period,
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

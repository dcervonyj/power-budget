import { describe, it, expect, beforeEach } from 'vitest';
import { createMock, type DeepMocked } from '@golevelup/ts-vitest';
import { IsoDate, IsoDateTime, PlanId } from '@power-budget/core';
import type {
  AuditLogPort,
  PlanRepository,
  PlannedItemRepository,
} from '../../../domain/plans/ports.js';
import {
  HH,
  NEW_ID,
  NOW,
  PARTNER,
  PLAN,
  USER,
  makeItem,
  makePlan,
} from '../../../test/doubles/plans.js';
import { CreatePlanUseCase } from './CreatePlanUseCase.js';
import { UpdatePlanUseCase } from './UpdatePlanUseCase.js';
import { ArchivePlanUseCase } from './ArchivePlanUseCase.js';
import { ClonePlanFromPreviousUseCase } from './ClonePlanFromPreviousUseCase.js';
import { ListPlansUseCase } from './ListPlansUseCase.js';
import { GetPlanUseCase } from './GetPlanUseCase.js';

const OCT = { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') };
const NOV = { start: IsoDate.of('2026-11-01'), end: IsoDate.of('2026-11-30') };
const NEW_PLAN_ID = PlanId.of(NEW_ID);

let planRepo: DeepMocked<PlanRepository>;
let itemRepo: DeepMocked<PlannedItemRepository>;
let auditLog: DeepMocked<AuditLogPort>;

beforeEach(() => {
  planRepo = createMock<PlanRepository>();
  itemRepo = createMock<PlannedItemRepository>();
  auditLog = createMock<AuditLogPort>();
});

const HINT = {
  counterpartyPattern: 'Landlord',
  amount: null,
  day: { dayOfMonth: 5, window: 1 },
};

describe('CreatePlanUseCase', () => {
  function useCase(): CreatePlanUseCase {
    return new CreatePlanUseCase(planRepo, auditLog, () => NEW_ID);
  }

  it('derives the monthly end, checks overlaps of that period and audits', async () => {
    const created = makePlan({ id: NEW_PLAN_ID });
    planRepo.list.mockResolvedValue([]);
    planRepo.create.mockResolvedValue(created);

    const result = await useCase().execute({
      name: 'October',
      type: 'household',
      periodKind: 'monthly',
      periodStart: OCT.start,
      baseCurrency: 'PLN',
      userId: USER,
      householdId: HH,
    });

    expect(result).toBe(created);
    expect(planRepo.list).toHaveBeenCalledWith({
      householdId: HH,
      viewerUserId: USER,
      status: 'active',
      overlapping: OCT,
    });
    expect(planRepo.create).toHaveBeenCalledWith({
      id: NEW_PLAN_ID,
      householdId: HH,
      ownerUserId: null,
      name: 'October',
      type: 'household',
      periodKind: 'monthly',
      period: OCT,
      baseCurrency: 'PLN',
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLAN_CREATED',
      subjectType: 'Plan',
      subjectId: NEW_PLAN_ID,
    });
  });

  it('sets the owner of a personal plan', async () => {
    planRepo.list.mockResolvedValue([]);
    planRepo.create.mockResolvedValue(makePlan());

    await useCase().execute({
      name: 'Mine',
      type: 'personal',
      periodKind: 'weekly',
      periodStart: IsoDate.of('2026-10-05'),
      baseCurrency: 'EUR',
      userId: USER,
      householdId: HH,
    });

    expect(planRepo.create).toHaveBeenCalledWith({
      id: NEW_PLAN_ID,
      householdId: HH,
      ownerUserId: USER,
      name: 'Mine',
      type: 'personal',
      periodKind: 'weekly',
      period: { start: IsoDate.of('2026-10-05'), end: IsoDate.of('2026-10-11') },
      baseCurrency: 'EUR',
    });
  });

  it('rejects a plan overlapping an active plan of the same type and kind (M13)', async () => {
    planRepo.list.mockResolvedValue([makePlan()]);

    await expect(
      useCase().execute({
        name: 'Mid October',
        type: 'household',
        periodKind: 'monthly',
        periodStart: IsoDate.of('2026-10-15'),
        baseCurrency: 'PLN',
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('PLAN_DUPLICATE');
    expect(planRepo.create).not.toHaveBeenCalled();
  });

  it('rejects a custom plan without an end date', async () => {
    await expect(
      useCase().execute({
        name: 'Trip',
        type: 'household',
        periodKind: 'custom',
        periodStart: OCT.start,
        baseCurrency: 'PLN',
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('PLAN_PERIOD_INVALID');
    expect(planRepo.list).not.toHaveBeenCalled();
  });
});

describe('UpdatePlanUseCase', () => {
  function useCase(): UpdatePlanUseCase {
    return new UpdatePlanUseCase(planRepo, auditLog);
  }

  it('renames and changes the base currency without an overlap check', async () => {
    const updated = makePlan({ name: 'Renamed', baseCurrency: 'EUR' });
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.update.mockResolvedValue(updated);

    const result = await useCase().execute({
      planId: PLAN,
      patch: { name: 'Renamed', baseCurrency: 'EUR' },
      userId: USER,
      householdId: HH,
    });

    expect(result).toBe(updated);
    expect(planRepo.list).not.toHaveBeenCalled();
    expect(planRepo.update).toHaveBeenCalledWith(
      PLAN,
      { name: 'Renamed', baseCurrency: 'EUR' },
      { householdId: HH },
    );
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLAN_UPDATED',
      subjectType: 'Plan',
      subjectId: PLAN,
    });
  });

  it('moves a monthly plan to a new start and derives the end', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.list.mockResolvedValue([makePlan()]);
    planRepo.update.mockResolvedValue(makePlan({ period: NOV }));

    await useCase().execute({
      planId: PLAN,
      patch: { periodStart: NOV.start },
      userId: USER,
      householdId: HH,
    });

    expect(planRepo.list).toHaveBeenCalledWith({
      householdId: HH,
      viewerUserId: USER,
      status: 'active',
      overlapping: NOV,
    });
    expect(planRepo.update).toHaveBeenCalledWith(PLAN, { period: NOV }, { householdId: HH });
  });

  it('keeps the start when only the end of a custom plan changes', async () => {
    const custom = makePlan({ periodKind: 'custom' });
    planRepo.findById.mockResolvedValue(custom);
    planRepo.list.mockResolvedValue([]);
    planRepo.update.mockResolvedValue(custom);

    await useCase().execute({
      planId: PLAN,
      patch: { periodEnd: IsoDate.of('2026-10-20') },
      userId: USER,
      householdId: HH,
    });

    expect(planRepo.update).toHaveBeenCalledWith(
      PLAN,
      { period: { start: OCT.start, end: IsoDate.of('2026-10-20') } },
      { householdId: HH },
    );
  });

  it('keeps the end of a custom plan when only the start moves', async () => {
    const custom = makePlan({ periodKind: 'custom' });
    planRepo.findById.mockResolvedValue(custom);
    planRepo.list.mockResolvedValue([]);
    planRepo.update.mockResolvedValue(custom);

    await useCase().execute({
      planId: PLAN,
      patch: { periodStart: IsoDate.of('2026-10-10') },
      userId: USER,
      householdId: HH,
    });

    expect(planRepo.update).toHaveBeenCalledWith(
      PLAN,
      { period: { start: IsoDate.of('2026-10-10'), end: OCT.end } },
      { householdId: HH },
    );
  });

  it('rejects a move onto another active plan', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.list.mockResolvedValue([makePlan({ id: PlanId.of(NEW_ID), period: NOV })]);

    await expect(
      useCase().execute({
        planId: PLAN,
        patch: { periodStart: NOV.start },
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('PLAN_DUPLICATE');
    expect(planRepo.update).not.toHaveBeenCalled();
  });

  it('rejects changes to an archived plan', async () => {
    planRepo.findById.mockResolvedValue(
      makePlan({ archivedAt: IsoDateTime.of('2026-10-02T00:00:00.000Z') }),
    );

    await expect(
      useCase().execute({ planId: PLAN, patch: { name: 'x' }, userId: USER, householdId: HH }),
    ).rejects.toThrow('PLAN_ARCHIVED');
  });

  it("hides a partner's personal plan", async () => {
    planRepo.findById.mockResolvedValue(makePlan({ type: 'personal', ownerUserId: PARTNER }));

    await expect(
      useCase().execute({ planId: PLAN, patch: { name: 'x' }, userId: USER, householdId: HH }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
    expect(planRepo.update).not.toHaveBeenCalled();
  });
});

describe('ArchivePlanUseCase', () => {
  function useCase(): ArchivePlanUseCase {
    return new ArchivePlanUseCase(planRepo, auditLog, () => NOW);
  }

  it('archives within the household scope and audits', async () => {
    planRepo.findById.mockResolvedValue(makePlan());

    await useCase().execute({ planId: PLAN, userId: USER, householdId: HH });

    expect(planRepo.findById).toHaveBeenCalledWith(PLAN, { householdId: HH });
    expect(planRepo.archive).toHaveBeenCalledWith(PLAN, NOW, { householdId: HH });
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLAN_ARCHIVED',
      subjectType: 'Plan',
      subjectId: PLAN,
    });
  });

  it('is idempotent for an archived plan', async () => {
    planRepo.findById.mockResolvedValue(
      makePlan({ archivedAt: IsoDateTime.of('2026-10-02T00:00:00.000Z') }),
    );

    await useCase().execute({ planId: PLAN, userId: USER, householdId: HH });

    expect(planRepo.archive).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it("throws PLAN_NOT_FOUND for another household's plan", async () => {
    planRepo.findById.mockResolvedValue(null);

    await expect(
      useCase().execute({ planId: PLAN, userId: USER, householdId: HH }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
    expect(planRepo.archive).not.toHaveBeenCalled();
  });

  it('defaults the clock to now', async () => {
    planRepo.findById.mockResolvedValue(makePlan());

    await new ArchivePlanUseCase(planRepo, auditLog).execute({
      planId: PLAN,
      userId: USER,
      householdId: HH,
    });

    expect(planRepo.archive).toHaveBeenCalledOnce();
  });
});

describe('ClonePlanFromPreviousUseCase', () => {
  const ids = ['01900000-0000-7000-8000-0000000000f1', '01900000-0000-7000-8000-0000000000f2'];

  function useCase(): ClonePlanFromPreviousUseCase {
    const queue = [...ids];

    return new ClonePlanFromPreviousUseCase(
      planRepo,
      itemRepo,
      auditLog,
      () => queue.shift() ?? NEW_ID,
    );
  }

  it('clones into the next period with the items and audits', async () => {
    const clonePlanId = PlanId.of(ids[0] ?? NEW_ID);
    const clone = makePlan({ id: clonePlanId, period: NOV });
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.list.mockResolvedValue([makePlan()]);
    planRepo.create.mockResolvedValue(clone);
    itemRepo.listByPlan.mockResolvedValue([makeItem({ note: 'beans', matchHint: HINT })]);

    const result = await useCase().execute({ sourcePlanId: PLAN, householdId: HH, userId: USER });

    expect(result).toBe(clone);
    expect(planRepo.list).toHaveBeenCalledWith({
      householdId: HH,
      viewerUserId: USER,
      status: 'active',
      overlapping: NOV,
    });
    expect(planRepo.create).toHaveBeenCalledWith({
      id: clonePlanId,
      householdId: HH,
      ownerUserId: null,
      name: 'October',
      type: 'household',
      periodKind: 'monthly',
      period: NOV,
      baseCurrency: 'PLN',
    });
    expect(itemRepo.listByPlan).toHaveBeenCalledWith(PLAN, { householdId: HH });
    expect(itemRepo.add).toHaveBeenCalledWith({
      id: ids[1],
      planId: clonePlanId,
      householdId: HH,
      categoryId: makeItem().categoryId,
      direction: 'expense',
      amount: { amountMinor: 150000n, currency: 'PLN' },
      note: 'beans',
      matchHint: HINT,
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLAN_CLONED',
      subjectType: 'Plan',
      subjectId: clonePlanId,
    });
  });

  it('uses the given name and start date', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.list.mockResolvedValue([]);
    planRepo.create.mockResolvedValue(makePlan());
    itemRepo.listByPlan.mockResolvedValue([]);

    await useCase().execute({
      sourcePlanId: PLAN,
      name: 'December',
      periodStart: IsoDate.of('2026-12-01'),
      householdId: HH,
      userId: USER,
    });

    expect(planRepo.create).toHaveBeenCalledWith({
      id: ids[0],
      householdId: HH,
      ownerUserId: null,
      name: 'December',
      type: 'household',
      periodKind: 'monthly',
      period: { start: IsoDate.of('2026-12-01'), end: IsoDate.of('2026-12-31') },
      baseCurrency: 'PLN',
    });
  });

  it('rejects a clone overlapping an active plan', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    planRepo.list.mockResolvedValue([makePlan({ id: PlanId.of(NEW_ID), period: NOV })]);

    await expect(
      useCase().execute({ sourcePlanId: PLAN, householdId: HH, userId: USER }),
    ).rejects.toThrow('PLAN_DUPLICATE');
    expect(planRepo.create).not.toHaveBeenCalled();
  });

  it("throws PLAN_NOT_FOUND for a partner's personal plan", async () => {
    planRepo.findById.mockResolvedValue(makePlan({ type: 'personal', ownerUserId: PARTNER }));

    await expect(
      useCase().execute({ sourcePlanId: PLAN, householdId: HH, userId: USER }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

describe('ListPlansUseCase', () => {
  it('lists the plans visible to the user with the status filter', async () => {
    const plans = [makePlan()];
    planRepo.list.mockResolvedValue(plans);

    const result = await new ListPlansUseCase(planRepo).execute({
      userId: USER,
      householdId: HH,
      status: 'archived',
    });

    expect(result).toBe(plans);
    expect(planRepo.list).toHaveBeenCalledWith({
      householdId: HH,
      viewerUserId: USER,
      status: 'archived',
    });
  });
});

describe('GetPlanUseCase', () => {
  it('returns a household plan', async () => {
    const plan = makePlan();
    planRepo.findById.mockResolvedValue(plan);

    const result = await new GetPlanUseCase(planRepo).execute({
      planId: PLAN,
      userId: USER,
      householdId: HH,
    });

    expect(result).toBe(plan);
  });

  it('returns the own personal plan and hides the partner one', async () => {
    const own = makePlan({ type: 'personal', ownerUserId: USER });
    planRepo.findById.mockResolvedValue(own);
    const useCase = new GetPlanUseCase(planRepo);

    await expect(useCase.execute({ planId: PLAN, userId: USER, householdId: HH })).resolves.toBe(
      own,
    );
    await expect(
      useCase.execute({ planId: PLAN, userId: PARTNER, householdId: HH }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

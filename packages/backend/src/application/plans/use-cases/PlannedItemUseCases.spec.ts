import { describe, it, expect, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { IsoDateTime, PlanId, PlannedItemId, PlannedItemVersionId } from '@power-budget/core';
import type {
  AuditLogPort,
  PlanRepository,
  PlannedItemRepository,
  PlannedItemVersionRepository,
} from '../../../domain/plans/ports.js';
import type { PlannedItemVersion } from '../../../domain/plans/entities.js';
import type { CategoryRepository } from '../../../domain/categories/ports.js';
import {
  CATEGORY,
  HH,
  ITEM,
  NEW_ID,
  PARTNER,
  PLAN,
  USER,
  makeCategory,
  makeItem,
  makePlan,
} from '../../../test/doubles/plans.js';
import { AddPlannedItemUseCase } from './AddPlannedItemUseCase.js';
import { UpdatePlannedItemUseCase } from './UpdatePlannedItemUseCase.js';
import { RemovePlannedItemUseCase } from './RemovePlannedItemUseCase.js';
import { GetPlannedItemHistoryUseCase } from './GetPlannedItemHistoryUseCase.js';
import { ListPlannedItemsUseCase } from './ListPlannedItemsUseCase.js';

const ARCHIVED = IsoDateTime.of('2026-10-02T00:00:00.000Z');
const AMOUNT = { amountMinor: 160000n, currency: 'PLN' as const };

let planRepo: MockProxy<PlanRepository>;
let itemRepo: MockProxy<PlannedItemRepository>;
let versionRepo: MockProxy<PlannedItemVersionRepository>;
let categoryRepo: MockProxy<CategoryRepository>;
let auditLog: MockProxy<AuditLogPort>;

beforeEach(() => {
  planRepo = mock<PlanRepository>();
  itemRepo = mock<PlannedItemRepository>();
  versionRepo = mock<PlannedItemVersionRepository>();
  categoryRepo = mock<CategoryRepository>();
  auditLog = mock<AuditLogPort>();
});

describe('AddPlannedItemUseCase', () => {
  function useCase(): AddPlannedItemUseCase {
    return new AddPlannedItemUseCase(planRepo, itemRepo, categoryRepo, auditLog, () => NEW_ID);
  }

  const input = {
    planId: PLAN,
    categoryId: CATEGORY,
    direction: 'expense' as const,
    amount: AMOUNT,
    userId: USER,
    householdId: HH,
  };

  it('adds the item with a visible, active category and audits', async () => {
    const created = makeItem({ id: PlannedItemId.of(NEW_ID) });
    planRepo.findById.mockResolvedValue(makePlan());
    categoryRepo.findById.mockResolvedValue(makeCategory());
    itemRepo.add.mockResolvedValue(created);

    const result = await useCase().execute(input);

    expect(result).toBe(created);
    expect(categoryRepo.findById).toHaveBeenCalledWith(CATEGORY, { householdId: HH });
    expect(itemRepo.add).toHaveBeenCalledWith({
      id: NEW_ID,
      planId: PLAN,
      householdId: HH,
      categoryId: CATEGORY,
      direction: 'expense',
      amount: AMOUNT,
      note: null,
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLANNED_ITEM_ADDED',
      subjectType: 'PlannedItem',
      subjectId: NEW_ID,
    });
  });

  it('rejects an unknown or archived category', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    categoryRepo.findById.mockResolvedValueOnce(null);
    categoryRepo.findById.mockResolvedValueOnce(makeCategory({ archivedAt: ARCHIVED }));

    await expect(useCase().execute(input)).rejects.toThrow('CATEGORY_NOT_FOUND');
    await expect(useCase().execute(input)).rejects.toThrow('CATEGORY_NOT_FOUND');
    expect(itemRepo.add).not.toHaveBeenCalled();
  });

  it('rejects an archived plan', async () => {
    planRepo.findById.mockResolvedValue(makePlan({ archivedAt: ARCHIVED }));

    await expect(useCase().execute(input)).rejects.toThrow('PLAN_ARCHIVED');
  });

  it("rejects another household's plan", async () => {
    planRepo.findById.mockResolvedValue(null);

    await expect(useCase().execute(input)).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

describe('UpdatePlannedItemUseCase', () => {
  function useCase(): UpdatePlannedItemUseCase {
    return new UpdatePlannedItemUseCase(planRepo, itemRepo, auditLog);
  }

  const input = {
    planId: PLAN,
    itemId: ITEM,
    patch: { amount: AMOUNT },
    reason: 'raise',
    userId: USER,
    householdId: HH,
  };

  it('updates an item of the plan with the reason and audits', async () => {
    const updated = makeItem({ amount: AMOUNT });
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(makeItem());
    itemRepo.update.mockResolvedValue(updated);

    const result = await useCase().execute(input);

    expect(result).toBe(updated);
    expect(itemRepo.update).toHaveBeenCalledWith(
      ITEM,
      { amount: AMOUNT },
      USER,
      { householdId: HH },
      'raise',
    );
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLANNED_ITEM_UPDATED',
      subjectType: 'PlannedItem',
      subjectId: ITEM,
    });
  });

  it('rejects an item of another plan', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(
      makeItem({ planId: PlanId.of('01900000-0000-7000-8000-0000000000c9') }),
    );

    await expect(useCase().execute(input)).rejects.toThrow('PLANNED_ITEM_NOT_FOUND');
    expect(itemRepo.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown item', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(null);

    await expect(useCase().execute(input)).rejects.toThrow('PLANNED_ITEM_NOT_FOUND');
  });

  it('rejects an archived plan', async () => {
    planRepo.findById.mockResolvedValue(makePlan({ archivedAt: ARCHIVED }));

    await expect(useCase().execute(input)).rejects.toThrow('PLAN_ARCHIVED');
    expect(itemRepo.findById).not.toHaveBeenCalled();
  });
});

describe('RemovePlannedItemUseCase', () => {
  function useCase(): RemovePlannedItemUseCase {
    return new RemovePlannedItemUseCase(planRepo, itemRepo, auditLog);
  }

  it('removes the item in the household scope and audits', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(makeItem());

    await useCase().execute({ planId: PLAN, itemId: ITEM, userId: USER, householdId: HH });

    expect(itemRepo.remove).toHaveBeenCalledWith(ITEM, { householdId: HH });
    expect(auditLog.record).toHaveBeenCalledWith({
      householdId: HH,
      actorUserId: USER,
      action: 'PLANNED_ITEM_REMOVED',
      subjectType: 'PlannedItem',
      subjectId: ITEM,
    });
  });

  it("rejects a partner's personal plan", async () => {
    planRepo.findById.mockResolvedValue(makePlan({ type: 'personal', ownerUserId: PARTNER }));

    await expect(
      useCase().execute({ planId: PLAN, itemId: ITEM, userId: USER, householdId: HH }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
    expect(itemRepo.remove).not.toHaveBeenCalled();
  });
});

describe('GetPlannedItemHistoryUseCase', () => {
  it('lists the versions of an item of a visible plan', async () => {
    const versions: PlannedItemVersion[] = [
      {
        id: PlannedItemVersionId.of(NEW_ID),
        plannedItemId: ITEM,
        householdId: HH,
        before: { amount: { amountMinor: 150000n, currency: 'PLN' }, note: null },
        after: { amount: AMOUNT },
        changedBy: USER,
        changedAt: IsoDateTime.of('2026-10-03T00:00:00.000Z'),
        reason: null,
      },
    ];
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(makeItem());
    versionRepo.listByItem.mockResolvedValue(versions);

    const result = await new GetPlannedItemHistoryUseCase(planRepo, itemRepo, versionRepo).execute({
      planId: PLAN,
      itemId: ITEM,
      userId: USER,
      householdId: HH,
    });

    expect(result).toBe(versions);
    expect(versionRepo.listByItem).toHaveBeenCalledWith(ITEM, { householdId: HH });
  });

  it('rejects an unknown item', async () => {
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.findById.mockResolvedValue(null);

    await expect(
      new GetPlannedItemHistoryUseCase(planRepo, itemRepo, versionRepo).execute({
        planId: PLAN,
        itemId: ITEM,
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('PLANNED_ITEM_NOT_FOUND');
    expect(versionRepo.listByItem).not.toHaveBeenCalled();
  });
});

describe('ListPlannedItemsUseCase', () => {
  it('lists the items of a visible plan', async () => {
    const items = [makeItem()];
    planRepo.findById.mockResolvedValue(makePlan());
    itemRepo.listByPlan.mockResolvedValue(items);

    const result = await new ListPlannedItemsUseCase(planRepo, itemRepo).execute({
      planId: PLAN,
      userId: USER,
      householdId: HH,
    });

    expect(result).toBe(items);
    expect(itemRepo.listByPlan).toHaveBeenCalledWith(PLAN, { householdId: HH });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId, PlannedItemId } from '@power-budget/core';
import type { Plan, PlannedItem } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import { UpdatePlannedItemUseCase } from './UpdatePlannedItemUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const ITEM_ID = PlannedItemId.of('01900000-0000-7000-8000-000000000002');
const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;

function makeMockPlan(): Plan {
  return {
    id: PLAN_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'My Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

function makeMockItem(overrides: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id: ITEM_ID,
    planId: PLAN_ID,
    householdId: HH_ID,
    categoryId: 'cat-1' as PlannedItem['categoryId'],
    direction: 'expense',
    amount: { amountMinor: 5000n, currency: 'PLN' },
    note: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-02T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

describe('UpdatePlannedItemUseCase', () => {
  let planRepo: PlanRepository;
  let plannedItemRepo: PlannedItemRepository;
  let auditLog: AuditLogPort;
  let useCase: UpdatePlannedItemUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    };
    plannedItemRepo = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      listByPlan: vi.fn(),
    };
    auditLog = { record: vi.fn() };
    useCase = new UpdatePlannedItemUseCase(planRepo, plannedItemRepo, auditLog);
  });

  it('updates item and records audit event (version written atomically by repo)', async () => {
    const updatedItem = makeMockItem({ amount: { amountMinor: 9000n, currency: 'PLN' } });
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(plannedItemRepo.update).mockResolvedValue(updatedItem);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    const result = await useCase.execute({
      planId: PLAN_ID,
      itemId: ITEM_ID,
      patch: { amount: { amountMinor: 9000n, currency: 'PLN' } },
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(result).toBe(updatedItem);
    expect(plannedItemRepo.update).toHaveBeenCalledWith(
      ITEM_ID,
      { amount: { amountMinor: 9000n, currency: 'PLN' } },
      USER_ID,
      undefined,
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLANNED_ITEM_UPDATED', subjectId: ITEM_ID }),
    );
  });

  it('passes reason to the repository when provided', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(plannedItemRepo.update).mockResolvedValue(makeMockItem());
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    await useCase.execute({
      planId: PLAN_ID,
      itemId: ITEM_ID,
      patch: { note: 'updated note' },
      reason: 'Correcting budget',
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(plannedItemRepo.update).toHaveBeenCalledWith(
      ITEM_ID,
      { note: 'updated note' },
      USER_ID,
      'Correcting budget',
    );
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        planId: PLAN_ID,
        itemId: ITEM_ID,
        patch: {},
        userId: USER_ID,
        householdId: HH_ID,
      }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

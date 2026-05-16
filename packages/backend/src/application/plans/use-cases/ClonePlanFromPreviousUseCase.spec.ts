import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId, PlannedItemId } from '@power-budget/core';
import type { Plan, PlannedItem } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  AuditLogPort,
} from '../../../domain/plans/ports.js';
import { ClonePlanFromPreviousUseCase } from './ClonePlanFromPreviousUseCase.js';

const SOURCE_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const NEW_ID = PlanId.of('01900000-0000-7000-8000-000000000002');
const ITEM_ID = PlannedItemId.of('01900000-0000-7000-8000-000000000003');
const USER_ID = 'u-1' as UserId;
const HH_ID = 'hh-1' as HouseholdId;

function makeSourcePlan(): Plan {
  return {
    id: SOURCE_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'Jan Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

function makeNewPlan(): Plan {
  return {
    id: NEW_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'Jan Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-02-01' as IsoDate, end: '2024-02-29' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-02-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-02-01T00:00:00Z' as IsoDateTime,
  };
}

function makeItem(): PlannedItem {
  return {
    id: ITEM_ID,
    planId: SOURCE_ID,
    householdId: HH_ID,
    categoryId: 'cat-1' as PlannedItem['categoryId'],
    direction: 'expense',
    amount: { amountMinor: 10000n, currency: 'PLN' },
    note: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

describe('ClonePlanFromPreviousUseCase', () => {
  let planRepo: PlanRepository;
  let plannedItemRepo: PlannedItemRepository;
  let auditLog: AuditLogPort;
  let idSequence: string[];
  let useCase: ClonePlanFromPreviousUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByPeriodEnd: vi.fn(),
    };
    plannedItemRepo = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      listByPlan: vi.fn(),
    };
    auditLog = { record: vi.fn() };
    idSequence = ['01900000-0000-7000-8000-000000000002', '01900000-0000-7000-8000-000000000004'];
    let callCount = 0;
    const generateId = vi.fn(
      () => idSequence[callCount++] ?? '01900000-0000-7000-8000-000000000099',
    );
    useCase = new ClonePlanFromPreviousUseCase(planRepo, plannedItemRepo, auditLog, generateId);
  });

  it('clones plan with next period and copies planned items', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeSourcePlan());
    vi.mocked(planRepo.create).mockResolvedValue(makeNewPlan());
    vi.mocked(plannedItemRepo.listByPlan).mockResolvedValue([makeItem()]);
    vi.mocked(plannedItemRepo.add).mockResolvedValue({
      ...makeItem(),
      id: PlannedItemId.of('01900000-0000-7000-8000-000000000004'),
      planId: NEW_ID,
    });
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    const result = await useCase.execute({
      sourcePlanId: SOURCE_ID,
      householdId: HH_ID,
      userId: USER_ID,
    });

    expect(result.id).toBe(NEW_ID);
    expect(planRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        period: { start: '2024-02-01', end: '2024-02-29' },
      }),
    );
    expect(plannedItemRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: NEW_ID,
        categoryId: makeItem().categoryId,
        direction: 'expense',
        amount: { amountMinor: 10000n, currency: 'PLN' },
      }),
    );
  });

  it('overrides name when provided', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeSourcePlan());
    vi.mocked(planRepo.create).mockResolvedValue({ ...makeNewPlan(), name: 'Feb Plan' });
    vi.mocked(plannedItemRepo.listByPlan).mockResolvedValue([]);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    await useCase.execute({
      sourcePlanId: SOURCE_ID,
      name: 'Feb Plan',
      householdId: HH_ID,
      userId: USER_ID,
    });

    expect(planRepo.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Feb Plan' }));
  });

  it('uses override period when provided', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeSourcePlan());
    vi.mocked(planRepo.create).mockResolvedValue(makeNewPlan());
    vi.mocked(plannedItemRepo.listByPlan).mockResolvedValue([]);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    await useCase.execute({
      sourcePlanId: SOURCE_ID,
      periodStart: '2024-03-01' as IsoDate,
      periodEnd: '2024-03-31' as IsoDate,
      householdId: HH_ID,
      userId: USER_ID,
    });

    expect(planRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        period: { start: '2024-03-01', end: '2024-03-31' },
      }),
    );
  });

  it('throws PLAN_NOT_FOUND when source plan does not exist', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ sourcePlanId: SOURCE_ID, householdId: HH_ID, userId: USER_ID }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

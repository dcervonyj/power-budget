import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, AuditLogPort } from '../../../domain/plans/ports.js';
import { UpdatePlanUseCase } from './UpdatePlanUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const USER_ID = 'u-1' as UserId;
const HH_ID = 'hh-1' as HouseholdId;

function makeMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'Old Name',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

function makePlanRepo(): PlanRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listActive: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    findByPeriodEnd: vi.fn(),
  };
}

describe('UpdatePlanUseCase', () => {
  let planRepo: PlanRepository;
  let auditLog: AuditLogPort;
  let useCase: UpdatePlanUseCase;

  beforeEach(() => {
    planRepo = makePlanRepo();
    auditLog = { record: vi.fn() };
    useCase = new UpdatePlanUseCase(planRepo, auditLog);
  });

  it('updates the plan name and records audit event', async () => {
    const existing = makeMockPlan();
    const updated = makeMockPlan({ name: 'New Name' });
    vi.mocked(planRepo.findById).mockResolvedValue(existing);
    vi.mocked(planRepo.update).mockResolvedValue(updated);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    const result = await useCase.execute({
      planId: PLAN_ID,
      patch: { name: 'New Name' },
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(result).toBe(updated);
    expect(planRepo.update).toHaveBeenCalledWith(
      PLAN_ID,
      { name: 'New Name' },
      { householdId: HH_ID },
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_UPDATED' }),
    );
  });

  it('throws PLAN_NOT_FOUND when plan does not exist in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, patch: {}, userId: USER_ID, householdId: HH_ID }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

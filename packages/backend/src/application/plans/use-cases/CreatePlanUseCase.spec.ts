import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, AuditLogPort } from '../../../domain/plans/ports.js';
import { CreatePlanUseCase } from './CreatePlanUseCase.js';

const PLAN_ID = '01900000-0000-7000-8000-000000000001' as ReturnType<typeof PlanId.of>;
const USER_ID = 'u-1' as UserId;
const HH_ID = 'hh-1' as HouseholdId;

function makeMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'Test Plan',
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

function makeAuditLog(): AuditLogPort {
  return { record: vi.fn() };
}

describe('CreatePlanUseCase', () => {
  let planRepo: PlanRepository;
  let auditLog: AuditLogPort;
  let generateId: () => string;
  let useCase: CreatePlanUseCase;

  beforeEach(() => {
    planRepo = makePlanRepo();
    auditLog = makeAuditLog();
    generateId = vi.fn().mockReturnValue('01900000-0000-7000-8000-000000000001');
    useCase = new CreatePlanUseCase(planRepo, auditLog, generateId);
  });

  it('creates a personal plan and records an audit event', async () => {
    const createdPlan = makeMockPlan();
    vi.mocked(planRepo.listActive).mockResolvedValue([]);
    vi.mocked(planRepo.create).mockResolvedValue(createdPlan);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    const result = await useCase.execute({
      name: 'Test Plan',
      type: 'personal',
      periodKind: 'monthly',
      periodStart: '2024-01-01' as IsoDate,
      periodEnd: '2024-01-31' as IsoDate,
      baseCurrency: 'PLN',
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(result).toBe(createdPlan);
    expect(planRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Plan', type: 'personal', ownerUserId: USER_ID }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_CREATED', subjectType: 'Plan' }),
    );
  });

  it('sets ownerUserId to null for household plans', async () => {
    const hhPlan = makeMockPlan({ type: 'household', ownerUserId: null });
    vi.mocked(planRepo.listActive).mockResolvedValue([]);
    vi.mocked(planRepo.create).mockResolvedValue(hhPlan);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    await useCase.execute({
      name: 'HH Plan',
      type: 'household',
      periodKind: 'monthly',
      periodStart: '2024-01-01' as IsoDate,
      periodEnd: '2024-01-31' as IsoDate,
      baseCurrency: 'PLN',
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(planRepo.create).toHaveBeenCalledWith(expect.objectContaining({ ownerUserId: null }));
  });

  it('throws PLAN_DUPLICATE when an active plan of same type+period exists', async () => {
    const existing = makeMockPlan({ type: 'personal', periodKind: 'monthly' });
    vi.mocked(planRepo.listActive).mockResolvedValue([existing]);

    await expect(
      useCase.execute({
        name: 'Duplicate',
        type: 'personal',
        periodKind: 'monthly',
        periodStart: '2024-02-01' as IsoDate,
        periodEnd: '2024-02-29' as IsoDate,
        baseCurrency: 'PLN',
        userId: USER_ID,
        householdId: HH_ID,
      }),
    ).rejects.toThrow('PLAN_DUPLICATE');
  });
});

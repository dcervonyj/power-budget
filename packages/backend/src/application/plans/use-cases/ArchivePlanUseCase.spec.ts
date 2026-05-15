import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, AuditLogPort } from '../../../domain/plans/ports.js';
import { ArchivePlanUseCase } from './ArchivePlanUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const USER_ID = 'u-1' as UserId;
const HH_ID = 'hh-1' as HouseholdId;

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

describe('ArchivePlanUseCase', () => {
  let planRepo: PlanRepository;
  let auditLog: AuditLogPort;
  let useCase: ArchivePlanUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    };
    auditLog = { record: vi.fn() };
    useCase = new ArchivePlanUseCase(planRepo, auditLog);
  });

  it('archives the plan and records audit event', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(planRepo.archive).mockResolvedValue(undefined);
    vi.mocked(auditLog.record).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, userId: USER_ID, householdId: HH_ID });

    expect(planRepo.archive).toHaveBeenCalledWith(PLAN_ID, expect.any(Date));
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAN_ARCHIVED', subjectId: PLAN_ID }),
    );
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, userId: USER_ID, householdId: HH_ID }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});

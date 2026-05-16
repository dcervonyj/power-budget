import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { PlanId, HouseholdId } from '@power-budget/core';
import type {
  PlanRepository,
  UnplannedTransactionReader,
  UnplannedTransactionPage,
} from '../../../domain/ports.js';
import type { Plan } from '../../../domain/entities.js';
import { GetUnplannedTransactionsUseCase } from '../GetUnplannedTransactionsUseCase.js';

const PLAN_ID = '01900000-0000-7000-8000-000000000001' as PlanId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makePlan(): Plan {
  return {
    id: PLAN_ID,
    householdId: HOUSEHOLD_ID,
    ownerUserId: null,
    name: 'Budget',
    type: 'household',
    periodKind: 'monthly',
    period: { start: '2025-01-01' as any, end: '2025-01-31' as any },
    status: 'active',
    baseCurrency: 'PLN' as any,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Plan;
}

const EMPTY_PAGE: UnplannedTransactionPage = { items: [], nextCursor: null };

describe('GetUnplannedTransactionsUseCase', () => {
  let planRepo: ReturnType<typeof mock<PlanRepository>>;
  let unplannedReader: ReturnType<typeof mock<UnplannedTransactionReader>>;
  let useCase: GetUnplannedTransactionsUseCase;

  beforeEach(() => {
    planRepo = mock<PlanRepository>();
    unplannedReader = mock<UnplannedTransactionReader>();
    useCase = new GetUnplannedTransactionsUseCase(planRepo, unplannedReader);
  });

  it('returns unplanned transactions for the plan period', async () => {
    const plan = makePlan();
    planRepo.findById.mockResolvedValue(plan);
    unplannedReader.list.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute({
      planId: PLAN_ID,
      householdId: HOUSEHOLD_ID,
      direction: 'expense',
      cursor: undefined,
      limit: 20,
    });

    expect(result).toBe(EMPTY_PAGE);
    expect(unplannedReader.list).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
      direction: 'expense',
      cursor: undefined,
      limit: 20,
    });
  });

  it('throws when plan is not found', async () => {
    planRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        planId: PLAN_ID,
        householdId: HOUSEHOLD_ID,
        direction: 'income',
        limit: 20,
      }),
    ).rejects.toThrow(/PLAN_NOT_FOUND/);
  });

  it('uses household scope when finding the plan', async () => {
    planRepo.findById.mockResolvedValue(null);

    await useCase.execute({
      planId: PLAN_ID,
      householdId: HOUSEHOLD_ID,
      direction: 'expense',
      limit: 20,
    }).catch(() => {});

    expect(planRepo.findById).toHaveBeenCalledWith(PLAN_ID, { householdId: HOUSEHOLD_ID });
  });

  it('does not call unplannedReader when plan is not found', async () => {
    planRepo.findById.mockResolvedValue(null);

    await useCase.execute({
      planId: PLAN_ID,
      householdId: HOUSEHOLD_ID,
      direction: 'expense',
      limit: 20,
    }).catch(() => {});

    expect(unplannedReader.list).not.toHaveBeenCalled();
  });
});

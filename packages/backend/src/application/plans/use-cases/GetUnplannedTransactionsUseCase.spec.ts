import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, IsoDate, IsoDateTime, PlanId, UserId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, UnplannedTransactionReader } from '../../../domain/plans/ports.js';
import {
  GetUnplannedTransactionsUseCase,
  UNPLANNED_DEFAULT_LIMIT,
  UNPLANNED_MAX_LIMIT,
} from './GetUnplannedTransactionsUseCase.js';

const HH = 'hh-1' as HouseholdId;
const ANN = 'u-ann' as UserId;
const PLAN = 'plan-1' as PlanId;

const PLAN_ROW: Plan = {
  id: PLAN,
  householdId: HH,
  ownerUserId: null,
  name: 'October',
  type: 'household',
  periodKind: 'monthly',
  period: { start: '2026-10-01' as IsoDate, end: '2026-10-31' as IsoDate },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
  updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
};

function setup(): {
  useCase: GetUnplannedTransactionsUseCase;
  reader: ReturnType<typeof mock<UnplannedTransactionReader>>;
} {
  const plans = mock<PlanRepository>();
  plans.findById.mockResolvedValue(PLAN_ROW);
  const reader = mock<UnplannedTransactionReader>();
  reader.list.mockResolvedValue({ items: [], nextCursor: null });

  return { useCase: new GetUnplannedTransactionsUseCase(plans, reader), reader };
}

describe('GetUnplannedTransactionsUseCase', () => {
  it("lists the caller's own transactions of the plan period", async () => {
    const { useCase, reader } = setup();

    await useCase.execute({
      planId: PLAN,
      householdId: HH,
      userId: ANN,
      direction: 'expense',
      cursor: 'abc',
      limit: 20,
    });

    expect(reader.list).toHaveBeenCalledWith({
      householdId: HH,
      ownerUserId: ANN,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      direction: 'expense',
      cursor: 'abc',
      limit: 20,
    });
  });

  it.each([
    [undefined, UNPLANNED_DEFAULT_LIMIT],
    [0, UNPLANNED_DEFAULT_LIMIT],
    [-5, UNPLANNED_DEFAULT_LIMIT],
    [2.5, UNPLANNED_DEFAULT_LIMIT],
    [UNPLANNED_MAX_LIMIT + 1, UNPLANNED_MAX_LIMIT],
    [100_000, UNPLANNED_MAX_LIMIT],
  ])('clamps limit %s to %s', async (limit, expected) => {
    const { useCase, reader } = setup();

    await useCase.execute({
      planId: PLAN,
      householdId: HH,
      userId: ANN,
      direction: 'income',
      limit,
    });

    expect(reader.list.mock.calls[0]![0].limit).toBe(expected);
  });
});

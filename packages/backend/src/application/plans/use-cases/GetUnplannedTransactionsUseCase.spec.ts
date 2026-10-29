import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, IsoDate, IsoDateTime, PlanId, UserId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, UnplannedTransactionReader } from '../../../domain/plans/ports.js';
import {
  GetUnplannedTransactionsUseCase,
  UNPLANNED_DEFAULT_LIMIT,
  UNPLANNED_MAX_LIMIT,
} from './GetUnplannedTransactionsUseCase.js';

const HH = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const ANN = UserId.of('01900000-df75-7d2d-8df4-707b8b171d37');
const PLAN = PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c');

const PLAN_ROW: Plan = {
  id: PLAN,
  householdId: HH,
  ownerUserId: null,
  name: 'October',
  type: 'household',
  periodKind: 'monthly',
  period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
  updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
};

function setup(): {
  useCase: GetUnplannedTransactionsUseCase;
  reader: ReturnType<typeof createMock<UnplannedTransactionReader>>;
} {
  const plans = createMock<PlanRepository>();
  plans.findById.mockResolvedValue(PLAN_ROW);
  const reader = createMock<UnplannedTransactionReader>();
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

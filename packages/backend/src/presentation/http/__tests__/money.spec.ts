import { describe, it, expect } from 'vitest';
import { CategoryId, IsoDate, PlanId, PlannedItemId } from '@power-budget/core';
import type { Money, PlanActualsView } from '@power-budget/core';
import { toMoneyDto } from '../money.js';
import { toPlanDashboardDto } from '../../plans/dto/plan-dashboard.dto.js';

// 2^53 + 1: not representable as a JS number.
const BEYOND_SAFE = 9007199254740993n;

function pln(amountMinor: bigint): Money {
  return { amountMinor, currency: 'PLN' };
}

describe('toMoneyDto', () => {
  it('serialises minor units as an exact integer string', () => {
    expect(toMoneyDto(pln(BEYOND_SAFE))).toEqual({
      amountMinor: '9007199254740993',
      currency: 'PLN',
    });
    expect(toMoneyDto(pln(-1500n))).toEqual({ amountMinor: '-1500', currency: 'PLN' });
  });
});

describe('toPlanDashboardDto', () => {
  const view: PlanActualsView = {
    planId: PlanId.of('01900000-0000-7000-8000-0000000000c1'),
    period: { start: IsoDate.of('2024-06-01'), end: IsoDate.of('2024-06-30') },
    baseCurrency: 'PLN',
    incomeLines: [],
    expenseLines: [
      {
        plannedItemId: PlannedItemId.of('01900000-0000-7000-8000-0000000000e1'),
        categoryId: CategoryId.of('01900000-0000-7000-8000-0000000000f1'),
        direction: 'expense',
        planned: pln(100000n),
        actual: pln(BEYOND_SAFE),
        remaining: pln(-1n),
        progressBand: 'over',
      },
    ],
    totalPlannedIncome: pln(0n),
    totalActualIncome: pln(0n),
    totalPlannedExpenses: pln(100000n),
    totalActualExpenses: pln(BEYOND_SAFE),
    unplannedExpenses: pln(0n),
    unplannedIncome: pln(0n),
    net: pln(-BEYOND_SAFE),
    asOf: IsoDate.of('2024-06-15'),
  };

  it('maps every Money to string minor units so JSON.stringify succeeds', () => {
    const json = JSON.parse(JSON.stringify(toPlanDashboardDto(view)));

    expect(json.expenseLines[0]).toEqual({
      plannedItemId: '01900000-0000-7000-8000-0000000000e1',
      categoryId: '01900000-0000-7000-8000-0000000000f1',
      direction: 'expense',
      planned: { amountMinor: '100000', currency: 'PLN' },
      actual: { amountMinor: '9007199254740993', currency: 'PLN' },
      remaining: { amountMinor: '-1', currency: 'PLN' },
      progressBand: 'over',
    });
    expect(json.net).toEqual({ amountMinor: '-9007199254740993', currency: 'PLN' });
    expect(json.period).toEqual({ start: '2024-06-01', end: '2024-06-30' });
  });
});

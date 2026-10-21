import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanActualsView,
  PlanId,
  UserId,
} from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanActualsReader, PlanRepository } from '../../../domain/plans/ports.js';
import { PlanActualsWeeklyDigestSummaryReader } from '../PlanActualsWeeklyDigestSummaryReader.js';

const HH = 'hh-1' as HouseholdId;
const ANN = 'u-ann' as UserId;
const BOB = 'u-bob' as UserId;
const AT = new Date('2026-10-19T06:00:00Z');

function plan(id: string, overrides: Partial<Plan>): Plan {
  return {
    id: id as PlanId,
    householdId: HH,
    ownerUserId: null,
    name: id,
    type: 'household',
    periodKind: 'monthly',
    period: { start: '2026-10-01' as IsoDate, end: '2026-10-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

function view(): PlanActualsView {
  const zero = { amountMinor: 0n, currency: 'PLN' as const };

  return {
    planId: 'Shared' as PlanId,
    period: { start: '2026-10-01' as IsoDate, end: '2026-10-31' as IsoDate },
    baseCurrency: 'PLN',
    incomeLines: [],
    expenseLines: [],
    totalPlannedIncome: zero,
    totalActualIncome: zero,
    totalPlannedExpenses: { amountMinor: 5000n, currency: 'PLN' },
    totalActualExpenses: { amountMinor: 1200n, currency: 'PLN' },
    unplannedExpenses: zero,
    unplannedIncome: zero,
    net: zero,
    asOf: '2026-10-19' as IsoDate,
  };
}

function setup(plans: Plan[]): {
  reader: PlanActualsWeeklyDigestSummaryReader;
  actuals: PlanActualsReader;
} {
  const repo = mock<PlanRepository>();
  repo.listActive.mockResolvedValue(plans);
  const actuals = mock<PlanActualsReader>();
  actuals.read.mockResolvedValue(view());

  return { reader: new PlanActualsWeeklyDigestSummaryReader(repo, actuals), actuals };
}

describe('PlanActualsWeeklyDigestSummaryReader', () => {
  it('summarises the household plan with its expense totals and period', async () => {
    const { reader, actuals } = setup([
      plan('Ann personal', { type: 'personal', ownerUserId: ANN }),
      plan('Shared', {}),
    ]);

    const summary = await reader.read({ householdId: HH, userId: ANN }, AT);

    expect(summary).toEqual({
      planName: 'Shared',
      totalSpent: { amountMinor: 1200n, currency: 'PLN' },
      totalPlanned: { amountMinor: 5000n, currency: 'PLN' },
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });
    expect(actuals.read).toHaveBeenCalledWith('Shared', AT);
  });

  it("never uses another member's personal plan or an archived plan", async () => {
    const { reader } = setup([
      plan('Ann personal', { type: 'personal', ownerUserId: ANN }),
      plan('Old shared', { archivedAt: '2026-10-02T00:00:00Z' as IsoDateTime }),
    ]);

    expect(await reader.read({ householdId: HH, userId: BOB }, AT)).toBeNull();
    expect((await reader.read({ householdId: HH, userId: ANN }, AT))?.planName).toBe(
      'Ann personal',
    );
  });
});

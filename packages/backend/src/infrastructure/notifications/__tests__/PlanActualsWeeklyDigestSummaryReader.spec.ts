import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, IsoDate, IsoDateTime, PlanId, UserId } from '@power-budget/core';
import type { PlanActualsView } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanActualsReader, PlanRepository } from '../../../domain/plans/ports.js';
import {
  PlanActualsWeeklyDigestSummaryReader,
  type RunScopedPlanActuals,
} from '../PlanActualsWeeklyDigestSummaryReader.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

const HH = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const ANN = UserId.of('01900000-df75-7d2d-8df4-707b8b171d37');
const BOB = UserId.of('01900000-2f5d-7fe5-8e88-c03764db3083');
const AT = new Date('2026-10-19T06:00:00Z');

function plan(id: string, overrides: Partial<Plan>): Plan {
  return {
    id: PlanId.of(testUuid(id)),
    householdId: HH,
    ownerUserId: null,
    name: id,
    type: 'household',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function view(): PlanActualsView {
  const zero = { amountMinor: 0n, currency: 'PLN' as const };

  return {
    planId: PlanId.of('01900000-50d0-7d8d-8d11-a959484cb838'),
    period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
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
    asOf: IsoDate.of('2026-10-19'),
  };
}

function setup(plans: Plan[]): {
  reader: PlanActualsWeeklyDigestSummaryReader;
  actuals: PlanActualsReader;
  scoped: RunScopedPlanActuals;
} {
  const repo = createMock<PlanRepository>();
  repo.list.mockResolvedValue(plans);
  const actuals = createMock<PlanActualsReader>();
  actuals.read.mockResolvedValue(view());

  const scoped = createMock<RunScopedPlanActuals>();
  scoped.runScoped.mockReturnValue(actuals);

  return { reader: new PlanActualsWeeklyDigestSummaryReader(repo, scoped), actuals, scoped };
}

describe('PlanActualsWeeklyDigestSummaryReader', () => {
  it('summarises the household plan with its expense totals and period', async () => {
    const shared = plan('01900000-50d0-7d8d-8d11-a959484cb838', {});
    const { reader, actuals } = setup([
      plan('Ann personal', { type: 'personal', ownerUserId: ANN }),
      shared,
    ]);

    const summary = await reader.startRun(AT).read({ householdId: HH, userId: ANN });

    expect(summary).toEqual({
      planName: '01900000-50d0-7d8d-8d11-a959484cb838',
      totalSpent: { amountMinor: 1200n, currency: 'PLN' },
      totalPlanned: { amountMinor: 5000n, currency: 'PLN' },
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });
    expect(actuals.read).toHaveBeenCalledWith(shared, AT);
  });

  it("never uses another member's personal plan or an archived plan", async () => {
    const { reader } = setup([
      plan('Ann personal', { type: 'personal', ownerUserId: ANN }),
      plan('Old shared', { archivedAt: IsoDateTime.of('2026-10-02T00:00:00Z') }),
    ]);

    expect(await reader.startRun(AT).read({ householdId: HH, userId: BOB })).toBeNull();
    expect((await reader.startRun(AT).read({ householdId: HH, userId: ANN }))?.planName).toBe(
      'Ann personal',
    );
  });

  it('computes a shared plan once per run for all members of the household', async () => {
    const shared = plan('01900000-50d0-7d8d-8d11-a959484cb838', {});
    const { reader, actuals, scoped } = setup([shared]);
    const run = reader.startRun(AT);

    await run.read({ householdId: HH, userId: ANN });
    await run.read({ householdId: HH, userId: BOB });

    expect(actuals.read).toHaveBeenCalledTimes(1);
    expect(actuals.read).toHaveBeenCalledWith(shared, AT);
    expect(scoped.runScoped).toHaveBeenCalledTimes(1);
  });

  it('starts fresh caches for every run', async () => {
    const { reader, actuals, scoped } = setup([plan('01900000-50d0-7d8d-8d11-a959484cb838', {})]);

    await reader.startRun(AT).read({ householdId: HH, userId: ANN });
    await reader.startRun(AT).read({ householdId: HH, userId: ANN });

    expect(actuals.read).toHaveBeenCalledTimes(2);
    expect(scoped.runScoped).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it } from 'vitest';
import { d7Model, pln } from '../overviewFixtures.js';

describe('toOverviewModel (D7 spec month, 22 Oct 2026)', () => {
  it('adds unplanned to spent and keeps the rest as left', () => {
    const model = d7Model();

    expect(model.planName).toBe('October');
    expect(model.planned).toEqual({ amountMinor: 1180000n, currency: 'PLN' });
    expect(model.spent).toEqual({ amountMinor: 703000n, currency: 'PLN' });
    expect(model.left).toEqual({ amountMinor: 477000n, currency: 'PLN' });
    expect(model.leftFraction).toBeCloseTo(0.4042, 4);
    expect(model.hasPlan).toBe(true);
    expect(model.incomeReceived).toEqual({ amountMinor: 1300000n, currency: 'PLN' });
    expect(model.incomePlanned).toEqual({ amountMinor: 1420000n, currency: 'PLN' });
    expect(model.unplannedExpenses).toEqual({ amountMinor: 42500n, currency: 'PLN' });
  });

  it('gives 477 zł a day for the 10 days left, under pace, ≈ 9 906 at this pace', () => {
    const { timing } = d7Model();

    expect(timing).toEqual({
      kind: 'current',
      today: '2026-10-22',
      day: 22,
      totalDays: 31,
      safeToSpend: {
        perDay: { amountMinor: 47700n, currency: 'PLN' },
        daysLeft: 10,
        isOver: false,
      },
      pace: {
        kind: 'under',
        monthLeftFraction: 1 - 22 / 31,
        spentPercent: 60,
        elapsedPercent: 71,
        leftPercent: 40,
        monthLeftPercent: 29,
      },
      forecast: {
        total: { amountMinor: 990600n, currency: 'PLN' },
        versusPlan: { amountMinor: 189400n, currency: 'PLN' },
      },
    });
  });

  it('lists the over-plan category first, marks rent as paid and forecasts only overruns', () => {
    const { categories } = d7Model();

    expect(categories.map((category) => category.label)).toEqual([
      'Eating out',
      'Rent',
      'Groceries',
      'Bills & insurance',
      'Transport',
      'Health',
      'Subscriptions',
      'Home',
      'Anna · personal',
      'Marek · personal',
    ]);
    expect(categories[0]).toEqual({
      id: 'd7-eating-out',
      label: 'Eating out',
      spentMinor: 56250n,
      plannedMinor: 50000n,
      currency: 'PLN',
      status: 'over',
      paid: false,
      forecastMinor: 79300n,
    });
    expect(categories[1]).toEqual({
      id: 'd7-rent',
      label: 'Rent',
      spentMinor: 340000n,
      plannedMinor: 340000n,
      currency: 'PLN',
      status: 'neutral',
      paid: true,
    });
    expect(categories[2]).toEqual({
      id: 'd7-groceries',
      label: 'Groceries',
      spentMinor: 114864n,
      plannedMinor: 220000n,
      currency: 'PLN',
      status: 'ok',
      paid: false,
    });
  });

  it('sums the items of one category', () => {
    const model = d7Model({
      expenseLines: [
        {
          plannedItemId: 'a',
          categoryId: 'd7-groceries',
          direction: 'expense',
          planned: pln(100000n),
          actual: pln(40000n),
          remaining: pln(60000n),
          progressBand: 'ok',
        },
        {
          plannedItemId: 'b',
          categoryId: 'd7-groceries',
          direction: 'expense',
          planned: pln(20000n),
          actual: pln(5000n),
          remaining: pln(15000n),
          progressBand: 'ok',
        },
      ],
    });

    expect(model.categories).toEqual([
      {
        id: 'd7-groceries',
        label: 'Groceries',
        spentMinor: 45000n,
        plannedMinor: 120000n,
        currency: 'PLN',
        status: 'ok',
        paid: false,
      },
    ]);
  });

  it('gives 0 a day, over, and over pace once the plan is spent', () => {
    const { timing, left } = d7Model({
      totalActualExpenses: pln(1200000n),
      unplannedExpenses: pln(0n),
    });

    expect(left).toEqual({ amountMinor: -20000n, currency: 'PLN' });
    expect(timing.kind).toBe('current');
    if (timing.kind === 'current') {
      expect(timing.safeToSpend).toEqual({
        perDay: { amountMinor: 0n, currency: 'PLN' },
        daysLeft: 10,
        isOver: true,
      });
      expect(timing.pace.kind).toBe('over');
      // 12 000 of 11 800: the real share, not capped at 100 %.
      expect(timing.pace.spentPercent).toBe(102);
      expect(timing.forecast.versusPlan.amountMinor < 0n).toBe(true);
    }
  });

  it('has no lens, pace or forecasts for a past or future plan', () => {
    const past = d7Model({ asOf: '2026-11-03' });
    const future = d7Model({ asOf: '2026-09-20' });

    expect(past.timing).toEqual({ kind: 'past' });
    expect(future.timing).toEqual({ kind: 'future' });
    expect(past.categories.some((category) => category.forecastMinor !== undefined)).toBe(false);
  });

  it('has no plan when nothing is planned', () => {
    const model = d7Model({
      expenseLines: [],
      totalPlannedExpenses: pln(0n),
      totalActualExpenses: pln(0n),
      unplannedExpenses: pln(0n),
    });

    expect(model.hasPlan).toBe(false);
    expect(model.leftFraction).toBe(0);
    expect(model.categories).toEqual([]);
  });
});

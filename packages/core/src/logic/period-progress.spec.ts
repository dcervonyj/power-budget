import { describe, expect, it } from 'vitest';
import type { PlanPeriod } from '../domain/plans/period.js';
import { IsoDate } from '../domain/shared/ids.js';
import { dailyAllowance, linearForecast } from './forecast.js';
import { periodProgress } from './period-progress.js';

describe('periodProgress', () => {
  const october: PlanPeriod = { kind: 'monthly', year: 2026, month: 10 };

  it('calculates October progress with today included in remaining days', () => {
    expect(periodProgress(october, IsoDate.of('2026-10-22'))).toEqual({
      state: 'current',
      elapsedFraction: 22 / 31,
      daysLeft: 10,
      totalDays: 31,
    });
  });

  it('handles the last day, future periods and past periods', () => {
    expect(periodProgress(october, IsoDate.of('2026-10-31'))).toMatchObject({
      state: 'current',
      elapsedFraction: 1,
      daysLeft: 1,
    });
    expect(periodProgress(october, IsoDate.of('2026-10-01'))).toMatchObject({
      state: 'current',
      elapsedFraction: 1 / 31,
      daysLeft: 31,
    });
    expect(periodProgress(october, IsoDate.of('2026-09-30'))).toMatchObject({
      state: 'future',
      elapsedFraction: 0,
      daysLeft: 31,
    });
    expect(periodProgress(october, IsoDate.of('2026-11-01'))).toMatchObject({
      state: 'past',
      elapsedFraction: 1,
      daysLeft: 0,
    });
  });
});

describe('forecast maths', () => {
  it('calculates allowance and marks exhausted budgets as over', () => {
    expect(dailyAllowance(4770n, 10)).toEqual({ amount: 477n, isOver: false });
    expect(dailyAllowance(4770n, 1)).toEqual({ amount: 4770n, isOver: false });
    expect(dailyAllowance(4770n, 0)).toEqual({ amount: 0n, isOver: false });
    expect(dailyAllowance(4770n, -1)).toEqual({ amount: 0n, isOver: false });
    expect(dailyAllowance(0n, 10)).toEqual({ amount: 0n, isOver: true });
    expect(dailyAllowance(-1n, 10)).toEqual({ amount: 0n, isOver: true });
  });

  it('forecasts totals and individual lines without number precision loss', () => {
    expect(linearForecast(7030n, 0.71)).toBe(9901n);
    expect(linearForecast([100n, 200n], 0.5)).toEqual([200n, 400n]);
    expect(linearForecast(100n, 0)).toBe(0n);
    expect(linearForecast(100n, Number.NaN)).toBe(0n);
    expect(linearForecast(9_007_199_254_740_993n, 0.5)).toBe(18_014_398_509_481_986n);
  });
});

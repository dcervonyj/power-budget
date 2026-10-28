import { describe, it, expect } from 'vitest';
import { IsoDate, IsoDateTime } from '@power-budget/core';
import { PlanCloning, PlanPeriods } from './plan-cloning.js';
import type { Plan } from './entities.js';

function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1' as Plan['id'],
    householdId: 'hh-1' as Plan['householdId'],
    ownerUserId: 'u-1' as Plan['ownerUserId'],
    name: 'Jan Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('PlanCloning', () => {
  describe('computeClonePeriod — monthly', () => {
    it('returns next contiguous month', () => {
      const plan = makePlan({
        periodKind: 'monthly',
        period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') },
      });
      const next = PlanCloning.computeClonePeriod(plan);
      expect(next.start).toBe('2024-02-01');
      expect(next.end).toBe('2024-02-29'); // 2024 is a leap year
    });
  });

  describe('computeClonePeriod — monthly month-end anchors', () => {
    function roll(firstStart: string, count: number): string[] {
      const starts: string[] = [];
      let period = PlanPeriods.resolve('monthly', IsoDate.of(firstStart));
      for (let i = 0; i < count; i += 1) {
        starts.push(period.start);
        period = PlanCloning.computeClonePeriod(makePlan({ period }));
      }

      return starts;
    }

    it('rolls a 31st anchor through a non-leap year and keeps the anchor', () => {
      expect(roll('2025-01-31', 12)).toEqual([
        '2025-01-31',
        '2025-02-28',
        '2025-03-31',
        '2025-04-30',
        '2025-05-31',
        '2025-06-30',
        '2025-07-31',
        '2025-08-31',
        '2025-09-30',
        '2025-10-31',
        '2025-11-30',
        '2025-12-31',
      ]);
    });

    it('rolls a 31st anchor through a leap year (2028-02-29)', () => {
      expect(roll('2028-01-31', 4)).toEqual([
        '2028-01-31',
        '2028-02-29',
        '2028-03-31',
        '2028-04-30',
      ]);
    });

    it('rolls a 30th anchor through a leap and a non-leap February', () => {
      expect(roll('2028-01-30', 4)).toEqual([
        '2028-01-30',
        '2028-02-29',
        '2028-03-30',
        '2028-04-30',
      ]);
      expect(roll('2025-01-30', 3)).toEqual(['2025-01-30', '2025-02-28', '2025-03-30']);
    });

    it('rolls a 29th anchor through a leap and a non-leap February', () => {
      expect(roll('2028-01-29', 3)).toEqual(['2028-01-29', '2028-02-29', '2028-03-29']);
      expect(roll('2025-01-29', 3)).toEqual(['2025-01-29', '2025-02-28', '2025-03-29']);
    });

    it('does not turn a 28th anchor into a month-end anchor', () => {
      expect(roll('2025-01-28', 4)).toEqual([
        '2025-01-28',
        '2025-02-28',
        '2025-03-28',
        '2025-04-28',
      ]);
    });

    it('ends a 31 Jan period on 27 Feb and a 31 Mar period on 29 Apr', () => {
      const jan = PlanPeriods.resolve('monthly', IsoDate.of('2025-01-31'));
      expect(jan.end).toBe('2025-02-27');
      const mar = PlanPeriods.resolve('monthly', IsoDate.of('2025-03-31'));
      expect(mar.end).toBe('2025-04-29');
    });

    it('keeps contiguous periods without gaps or overlaps', () => {
      const jan = PlanPeriods.resolve('monthly', IsoDate.of('2025-01-31'));
      const feb = PlanCloning.computeClonePeriod(makePlan({ period: jan }));
      expect(feb).toEqual({ start: '2025-02-28', end: '2025-03-30' });
    });
  });

  describe('computeClonePeriod — weekly', () => {
    it('returns next 7-day period', () => {
      const plan = makePlan({
        periodKind: 'weekly',
        period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-07') },
      });
      const next = PlanCloning.computeClonePeriod(plan);
      expect(next.start).toBe('2024-01-08');
      expect(next.end).toBe('2024-01-14');
    });
  });

  describe('computeClonePeriod — custom', () => {
    it('shifts by the same duration', () => {
      const plan = makePlan({
        periodKind: 'custom',
        period: { start: IsoDate.of('2024-01-10'), end: IsoDate.of('2024-01-24') },
      });
      const next = PlanCloning.computeClonePeriod(plan);
      expect(next.start).toBe('2024-01-25');
      expect(next.end).toBe('2024-02-08'); // 15-day period shifted
    });
  });

  describe('computeClonePeriod — override', () => {
    it('uses override period when provided', () => {
      const plan = makePlan();
      const override = { start: IsoDate.of('2024-06-01'), end: IsoDate.of('2024-06-30') };
      const next = PlanCloning.computeClonePeriod(plan, override);
      expect(next.start).toBe('2024-06-01');
    });
  });

  describe('assertNoDuplicateActivePlan', () => {
    const JAN = { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') };
    const FEB = { start: IsoDate.of('2024-02-01'), end: IsoDate.of('2024-02-29') };
    const candidate = {
      type: 'personal' as const,
      periodKind: 'monthly' as const,
      period: JAN,
      ownerUserId: 'u-1' as Plan['ownerUserId'],
    };

    it('passes when no conflicts', () => {
      expect(() => PlanCloning.assertNoDuplicateActivePlan([], candidate)).not.toThrow();
    });

    it('throws when an active plan of the same type and kind overlaps the period', () => {
      const existing = makePlan({
        period: { start: IsoDate.of('2024-01-15'), end: IsoDate.of('2024-02-14') },
      });
      expect(() => PlanCloning.assertNoDuplicateActivePlan([existing], candidate)).toThrow(
        'PLAN_DUPLICATE',
      );
    });

    it('allows the same kind in a period that does not overlap (M13: not "today")', () => {
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([makePlan({ period: FEB })], candidate),
      ).not.toThrow();
    });

    it('ignores archived plans and the candidate itself', () => {
      const archived = makePlan({ archivedAt: IsoDateTime.of('2024-01-02T00:00:00Z') });
      const self = makePlan();
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([archived, self], { ...candidate, id: self.id }),
      ).not.toThrow();
    });

    it("does not conflict with another member's personal plan", () => {
      const partners = makePlan({ ownerUserId: 'u-2' as Plan['ownerUserId'] });
      expect(() => PlanCloning.assertNoDuplicateActivePlan([partners], candidate)).not.toThrow();
    });

    it('conflicts with any household plan of the same kind', () => {
      const household = makePlan({ type: 'household', ownerUserId: null });
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([household], {
          ...candidate,
          type: 'household',
          ownerUserId: null,
        }),
      ).toThrow('PLAN_DUPLICATE');
    });

    it('allows multiple custom plans', () => {
      const existing = makePlan({ periodKind: 'custom' });
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([existing], { ...candidate, periodKind: 'custom' }),
      ).not.toThrow();
    });

    it('does not conflict across types (personal vs household)', () => {
      const existing = makePlan({ type: 'household', ownerUserId: null });
      expect(() => PlanCloning.assertNoDuplicateActivePlan([existing], candidate)).not.toThrow();
    });
  });

  describe('PlanPeriods.resolve', () => {
    it('derives a weekly end', () => {
      expect(PlanPeriods.resolve('weekly', IsoDate.of('2024-01-01'))).toEqual({
        start: '2024-01-01',
        end: '2024-01-07',
      });
    });

    it('derives a monthly end', () => {
      expect(PlanPeriods.resolve('monthly', IsoDate.of('2024-02-01'))).toEqual({
        start: '2024-02-01',
        end: '2024-02-29',
      });
    });

    it('keeps an explicit end', () => {
      expect(
        PlanPeriods.resolve('custom', IsoDate.of('2024-01-01'), IsoDate.of('2024-01-10')),
      ).toEqual({ start: '2024-01-01', end: '2024-01-10' });
    });

    it('requires an end for custom plans', () => {
      expect(() => PlanPeriods.resolve('custom', IsoDate.of('2024-01-01'))).toThrow(
        'PLAN_PERIOD_INVALID',
      );
    });

    it('rejects an end before the start', () => {
      expect(() =>
        PlanPeriods.resolve('monthly', IsoDate.of('2024-01-10'), IsoDate.of('2024-01-01')),
      ).toThrow('PLAN_PERIOD_INVALID');
    });
  });
});

import { describe, it, expect } from 'vitest';
import type { IsoDate, IsoDateTime } from '@power-budget/core';
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
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

describe('PlanCloning', () => {
  describe('computeClonePeriod — monthly', () => {
    it('returns next contiguous month', () => {
      const plan = makePlan({
        periodKind: 'monthly',
        period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
      });
      const next = PlanCloning.computeClonePeriod(plan);
      expect(next.start).toBe('2024-02-01');
      expect(next.end).toBe('2024-02-29'); // 2024 is a leap year
    });
  });

  describe('computeClonePeriod — weekly', () => {
    it('returns next 7-day period', () => {
      const plan = makePlan({
        periodKind: 'weekly',
        period: { start: '2024-01-01' as IsoDate, end: '2024-01-07' as IsoDate },
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
        period: { start: '2024-01-10' as IsoDate, end: '2024-01-24' as IsoDate },
      });
      const next = PlanCloning.computeClonePeriod(plan);
      expect(next.start).toBe('2024-01-25');
      expect(next.end).toBe('2024-02-08'); // 15-day period shifted
    });
  });

  describe('computeClonePeriod — override', () => {
    it('uses override period when provided', () => {
      const plan = makePlan();
      const override = { start: '2024-06-01' as IsoDate, end: '2024-06-30' as IsoDate };
      const next = PlanCloning.computeClonePeriod(plan, override);
      expect(next.start).toBe('2024-06-01');
    });
  });

  describe('assertNoDuplicateActivePlan', () => {
    const JAN = { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate };
    const FEB = { start: '2024-02-01' as IsoDate, end: '2024-02-29' as IsoDate };
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
        period: { start: '2024-01-15' as IsoDate, end: '2024-02-14' as IsoDate },
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
      const archived = makePlan({ archivedAt: '2024-01-02T00:00:00Z' as IsoDateTime });
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
      expect(PlanPeriods.resolve('weekly', '2024-01-01' as IsoDate)).toEqual({
        start: '2024-01-01',
        end: '2024-01-07',
      });
    });

    it('derives a monthly end', () => {
      expect(PlanPeriods.resolve('monthly', '2024-02-01' as IsoDate)).toEqual({
        start: '2024-02-01',
        end: '2024-02-29',
      });
    });

    it('keeps an explicit end', () => {
      expect(
        PlanPeriods.resolve('custom', '2024-01-01' as IsoDate, '2024-01-10' as IsoDate),
      ).toEqual({ start: '2024-01-01', end: '2024-01-10' });
    });

    it('requires an end for custom plans', () => {
      expect(() => PlanPeriods.resolve('custom', '2024-01-01' as IsoDate)).toThrow(
        'PLAN_PERIOD_INVALID',
      );
    });

    it('rejects an end before the start', () => {
      expect(() =>
        PlanPeriods.resolve('monthly', '2024-01-10' as IsoDate, '2024-01-01' as IsoDate),
      ).toThrow('PLAN_PERIOD_INVALID');
    });
  });
});

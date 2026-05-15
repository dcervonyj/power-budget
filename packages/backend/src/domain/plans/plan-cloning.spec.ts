import { describe, it, expect } from 'vitest';
import type { IsoDate, IsoDateTime } from '@power-budget/core';
import { PlanCloning } from './plan-cloning.js';
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
    it('passes when no conflicts', () => {
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([], { type: 'personal', periodKind: 'monthly' }),
      ).not.toThrow();
    });

    it('throws when duplicate active plan exists', () => {
      const existing = makePlan({ type: 'personal', periodKind: 'monthly' });
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([existing], {
          type: 'personal',
          periodKind: 'monthly',
        }),
      ).toThrow('PLAN_DUPLICATE');
    });

    it('allows multiple custom plans', () => {
      const existing = makePlan({ type: 'personal', periodKind: 'custom' });
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([existing], {
          type: 'personal',
          periodKind: 'custom',
        }),
      ).not.toThrow();
    });

    it('does not conflict across types (personal vs household)', () => {
      const existing = makePlan({ type: 'household', periodKind: 'monthly' });
      expect(() =>
        PlanCloning.assertNoDuplicateActivePlan([existing], {
          type: 'personal',
          periodKind: 'monthly',
        }),
      ).not.toThrow();
    });
  });
});

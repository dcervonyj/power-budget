import { describe, it, expect } from 'vitest';
import { IsoDateTime, UserId } from '@power-budget/core';
import { PlanAccess } from './plan-access.js';
import { makePlan } from '../../test/doubles/plans.js';

const OWNER = UserId.of('01900000-0000-7000-8000-0000000000b1');
const PARTNER = UserId.of('01900000-0000-7000-8000-0000000000b2');

describe('PlanAccess', () => {
  it('shows household plans to every member', () => {
    expect(PlanAccess.isVisibleTo(makePlan(), PARTNER)).toBe(true);
  });

  it('shows a personal plan to its owner only', () => {
    const personal = makePlan({ type: 'personal', ownerUserId: OWNER });

    expect(PlanAccess.isVisibleTo(personal, OWNER)).toBe(true);
    expect(PlanAccess.isVisibleTo(personal, PARTNER)).toBe(false);
  });

  it('treats archived plans as read-only', () => {
    expect(() => PlanAccess.assertNotArchived(makePlan())).not.toThrow();
    expect(() =>
      PlanAccess.assertNotArchived(
        makePlan({ archivedAt: IsoDateTime.of('2026-10-02T00:00:00.000Z') }),
      ),
    ).toThrow('PLAN_ARCHIVED');
  });
});

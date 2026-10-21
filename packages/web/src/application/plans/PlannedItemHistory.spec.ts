import { describe, expect, it } from 'vitest';
import type { PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import { changedFields, rollUpPlannedItemHistory } from './PlannedItemHistory.js';

function version(overrides: Partial<PlannedItemVersionDto>): PlannedItemVersionDto {
  return {
    id: 'v',
    plannedItemId: 'item-1',
    before: null,
    after: {},
    changedBy: 'user-1',
    changedAt: '2026-10-02T10:00:00.000Z',
    reason: null,
    ...overrides,
  };
}

const pln = (amountMinor: string) => ({ amountMinor, currency: 'PLN' });

describe('rollUpPlannedItemHistory', () => {
  it('merges same-user edits within a minute (API order: newest first)', () => {
    const newest = version({
      id: 'v3',
      changedAt: '2026-10-02T10:00:40.000Z',
      before: { amount: pln('110000') },
      after: { amount: pln('120000') },
      reason: 'raise',
    });
    const older = version({
      id: 'v2',
      changedAt: '2026-10-02T10:00:00.000Z',
      before: { amount: pln('100000'), note: null },
      after: { amount: pln('110000'), note: 'rent' },
    });

    expect(rollUpPlannedItemHistory([newest, older])).toEqual([
      {
        ...newest,
        before: { amount: pln('100000'), note: null },
        after: { amount: pln('120000'), note: 'rent' },
        reason: 'raise',
      },
    ]);
  });

  it('keeps edits by another user or more than a minute apart', () => {
    const a = version({ id: 'a', changedAt: '2026-10-02T10:05:00.000Z' });
    const b = version({ id: 'b', changedAt: '2026-10-02T10:03:00.000Z' });
    const c = version({ id: 'c', changedAt: '2026-10-02T10:02:30.000Z', changedBy: 'user-2' });

    expect(rollUpPlannedItemHistory([a, b, c]).map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the creation entry (before null) as the oldest state', () => {
    const edit = version({
      id: 'v2',
      changedAt: '2026-10-02T10:00:10.000Z',
      before: { amount: pln('100000') },
      after: { amount: pln('120000') },
    });
    const created = version({ id: 'v1', after: { amount: pln('100000'), note: null } });

    expect(rollUpPlannedItemHistory([edit, created])).toEqual([
      { ...edit, before: { amount: pln('100000') }, after: { amount: pln('120000'), note: null } },
    ]);
  });
});

describe('changedFields', () => {
  it('lists amount then note, only for fields in `after`', () => {
    const v = version({ before: { note: 'old' }, after: { note: 'x', amount: pln('5') } });

    expect(changedFields(v)).toEqual([
      { field: 'amount', before: undefined, after: pln('5') },
      { field: 'note', before: 'old', after: 'x' },
    ]);
    expect(changedFields(version({ after: { note: null } }))).toEqual([
      { field: 'note', before: undefined, after: null },
    ]);
  });
});

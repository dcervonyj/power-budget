import { describe, expect, it } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';
import type { PlanDashboard } from '../../domain/dashboard/PlanDashboard.js';
import { groupByDay, isToSort, monthLeft, sortingProgress } from './TransactionListQueryView.js';

function tx(
  id: string,
  occurredOn: string,
  extra: Partial<Parameters<typeof TransactionMapper.fromListItem>[0]> = {},
) {
  return TransactionMapper.fromListItem({
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn,
    amount: { amountMinor: '-1500', currency: 'PLN' },
    description: id,
    merchant: null,
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
    ...extra,
  });
}

function money(amountMinor: bigint) {
  return { amountMinor, currency: 'PLN' };
}

function dashboard(planned: bigint, actual: bigint, unplanned: bigint): PlanDashboard {
  return {
    planId: 'p',
    planName: 'October',
    planType: 'personal',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    baseCurrency: 'PLN',
    asOf: '2026-10-22',
    income: [],
    expense: [],
    totals: {
      plannedIncome: money(0n),
      actualIncome: money(0n),
      plannedExpenses: money(planned),
      actualExpenses: money(actual),
      unplannedIncome: money(0n),
      unplannedExpenses: money(unplanned),
      net: money(0n),
    },
  };
}

describe('groupByDay', () => {
  it('groups neighbouring rows of one day and keeps the order', () => {
    const groups = groupByDay([
      tx('a', '2026-10-22'),
      tx('b', '2026-10-22'),
      tx('c', '2026-10-21'),
    ]);

    expect(groups.map((g) => [g.day, g.transactions.map((t) => t.id)])).toEqual([
      ['2026-10-22', ['a', 'b']],
      ['2026-10-21', ['c']],
    ]);
  });

  it('returns no group for no rows', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('monthLeft', () => {
  it('is planned minus mapped and unplanned spending, with its share of the plan', () => {
    const result = monthLeft(dashboard(1180000n, 660500n, 42500n));

    expect(result.left).toEqual({ amountMinor: 477000n, currency: 'PLN' });
    expect(result.fraction).toBe(0.404);
  });

  it('has no light left when the plan is overspent', () => {
    const result = monthLeft(dashboard(50000n, 56250n, 0n));

    expect(result.left.amountMinor).toBe(-6250n);
    expect(result.fraction).toBe(0);
  });

  it('has no light when nothing is planned', () => {
    expect(monthLeft(dashboard(0n, 0n, 0n)).fraction).toBe(0);
  });
});

describe('sortingProgress', () => {
  it('counts unmapped rows as to sort and mapped, transfer and ignored rows as sorted', () => {
    const rows = [
      tx('open', '2026-10-22'),
      tx('transfer', '2026-10-22', {
        transfer: { transferId: 't', counterpartTransactionId: null },
      }),
      tx('ignored', '2026-10-22', { ignored: true }),
      tx('cancelled', '2026-10-22', { status: 'cancelled' }),
    ];

    expect(sortingProgress(rows)).toEqual({ sorted: 2, toSort: 1 });
    expect(isToSort(rows[0] ?? tx('x', '2026-10-22'))).toBe(true);
  });
});

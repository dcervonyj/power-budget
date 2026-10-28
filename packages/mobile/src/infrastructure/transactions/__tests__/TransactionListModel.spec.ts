import { describe, expect, it } from 'vitest';
import type {
  PlanDashboardResponseDto,
  TransactionListItemDto,
} from '@power-budget/shared-app/contract';
import {
  filterCounts,
  groupByDay,
  monthSummaryOf,
  toListRows,
  visibleRows,
  waitingToSort,
} from '../TransactionListModel.js';

function item(overrides: Partial<TransactionListItemDto> & { id: string }): TransactionListItemDto {
  return {
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-22',
    amount: { amountMinor: '-8740', currency: 'PLN' },
    description: 'LIDL 0421',
    merchant: 'Lidl',
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    ...overrides,
  };
}

const MAPPING = {
  plannedItemId: 'p-1',
  planId: 'plan-1',
  planName: 'October',
  planArchived: false,
  categoryId: 'c-1',
  categoryName: 'Groceries',
  categorySeedKey: null,
  mappedAt: '2026-10-22T10:00:00.000Z',
};

const NONE: ReadonlySet<string> = new Set();
const ITEMS: TransactionListItemDto[] = [
  item({ id: 'a', mapping: MAPPING, mappingSource: 'rule' }),
  item({
    id: 'b',
    suggestedPlannedItemId: 'p-9',
    amount: { amountMinor: '-2450', currency: 'PLN' },
  }),
  item({
    id: 'c',
    occurredOn: '2026-10-21',
    transfer: { transferId: 't', counterpartTransactionId: null },
  }),
  item({ id: 'd', occurredOn: '2026-10-21', status: 'cancelled' }),
  item({
    id: 'e',
    occurredOn: '2026-10-21',
    status: 'live',
    mapping: MAPPING,
    mappingSource: 'manual',
  }),
];
const ROWS = toListRows(ITEMS, new Map([['p-9', 'Transport']]));

describe('toListRows', () => {
  it('drops cancelled rows and keeps exact minor units', () => {
    expect(ROWS.map((row) => row.data.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(ROWS[1]?.data.amountMinor).toBe(-2450n);
  });

  it('classifies transfers, mapped rows and rows to sort', () => {
    expect(ROWS.map((row) => row.kind)).toEqual(['sorted', 'toSort', 'transfer', 'sorted']);
    expect(ROWS.map((row) => row.data.status)).toEqual(['booked', 'to-sort', 'transfer', 'booked']);
  });

  it('counts an ignored, unmapped transaction as sorted, not as waiting', () => {
    const rows = toListRows([item({ id: 'z', ignored: true, mapping: null })], new Map());

    expect(rows[0]?.kind).toBe('sorted');
    expect(waitingToSort(rows, new Set(), 'PLN')).toBeUndefined();
  });

  it('names the suggested category of a row to sort', () => {
    expect(ROWS[1]?.data.suggestionLabel).toBe('Transport');
    expect(ROWS[1]?.suggestedPlannedItemId).toBe('p-9');
    expect(ROWS[0]?.data.suggestionLabel).toBeUndefined();
  });

  it('takes the title from the merchant and the subtitle from the category', () => {
    expect(ROWS[0]?.data.title).toBe('Lidl');
    expect(ROWS[0]?.data.subtitle).toBe('Groceries');
    expect(ROWS[1]?.data.subtitle).toBe('LIDL 0421');
  });

  it('flags a live row and the provenance of a manual or rule mapping', () => {
    expect(ROWS[3]?.live).toBe(true);
    expect(ROWS[3]?.provenance).toBe('manual');
    expect(ROWS[0]?.provenance).toBe('rule');
    expect(ROWS[1]?.provenance).toBeUndefined();
  });
});

describe('filters', () => {
  it('counts per filter and treats an applied suggestion as sorted', () => {
    expect(filterCounts(ROWS, NONE)).toEqual({ all: 4, toSort: 1, sorted: 2, transfers: 1 });
    expect(filterCounts(ROWS, new Set(['b']))).toEqual({
      all: 4,
      toSort: 0,
      sorted: 3,
      transfers: 1,
    });
  });

  it('shows the rows of the chosen filter', () => {
    expect(visibleRows(ROWS, 'toSort', NONE).map((row) => row.data.id)).toEqual(['b']);
    expect(visibleRows(ROWS, 'transfers', NONE).map((row) => row.data.id)).toEqual(['c']);
    expect(visibleRows(ROWS, 'sorted', new Set(['b'])).map((row) => row.data.id)).toEqual([
      'a',
      'b',
      'e',
    ]);
    expect(visibleRows(ROWS, 'all', NONE)).toHaveLength(4);
  });
});

describe('groupByDay', () => {
  it('groups neighbours of the same day in order', () => {
    expect(groupByDay(ROWS).map((group) => [group.day, group.rows.length])).toEqual([
      ['2026-10-22', 2],
      ['2026-10-21', 2],
    ]);
  });
});

describe('waitingToSort', () => {
  it('sums the spending of the rows still to sort', () => {
    expect(waitingToSort(ROWS, NONE, 'PLN')).toEqual({ amountMinor: 2450n, currency: 'PLN' });
  });

  it('is undefined once everything is sorted or in another currency', () => {
    expect(waitingToSort(ROWS, new Set(['b']), 'PLN')).toBeUndefined();
    expect(waitingToSort(ROWS, NONE, 'EUR')).toBeUndefined();
  });
});

function dashboard(planned: string, actual: string, unplanned: string): PlanDashboardResponseDto {
  const money = (amountMinor: string) => ({ amountMinor, currency: 'PLN' });

  return {
    planId: 'plan-1',
    period: { start: '2026-10-01', end: '2026-10-31' },
    baseCurrency: 'PLN',
    incomeLines: [],
    expenseLines: [],
    totalPlannedIncome: money('0'),
    totalActualIncome: money('0'),
    totalPlannedExpenses: money(planned),
    totalActualExpenses: money(actual),
    unplannedExpenses: money(unplanned),
    unplannedIncome: money('0'),
    net: money('0'),
    asOf: '2026-10-22T10:00:00.000Z',
  };
}

describe('monthSummaryOf', () => {
  it('is what is left of the plan over the plan', () => {
    const month = monthSummaryOf(dashboard('1180000', '600000', '103000'));

    expect(month.left).toEqual({ amountMinor: 477000n, currency: 'PLN' });
    expect(month.fraction).toBeCloseTo(0.404, 3);
    expect(month.state).toBe('under');
    expect(month.periodStart).toBe('2026-10-01');
  });

  it('reads over when more is spent than planned', () => {
    const month = monthSummaryOf(dashboard('100000', '90000', '20000'));

    expect(month.left.amountMinor).toBe(-10000n);
    expect(month.fraction).toBe(0);
    expect(month.state).toBe('over');
  });

  it('reads empty when nothing is left or planned', () => {
    expect(monthSummaryOf(dashboard('100000', '100000', '0')).state).toBe('empty');
    expect(monthSummaryOf(dashboard('0', '0', '0')).state).toBe('empty');
  });
});

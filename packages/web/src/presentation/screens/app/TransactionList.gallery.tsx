import React from 'react';
import {
  groupByDay,
  sortingProgress,
} from '../../../application/transactions/TransactionListQueryView.js';
import type { MonthLeft } from '../../../application/transactions/TransactionListQueryView.js';
import type { Transaction } from '../../../domain/transactions/Transaction.js';
import type { TransactionFilters } from '../../components/TransactionFilterBar.js';
import {
  TransactionListView,
  type TransactionListStatus,
  type TransactionListViewProps,
} from './TransactionListView.js';

const NO_FILTERS: TransactionFilters = {
  from: '',
  to: '',
  category: '',
  status: '',
  booking: '',
  currency: '',
  source: '',
  q: '',
};

const OCTOBER: MonthLeft = {
  periodStart: '2026-10-01',
  left: { amountMinor: 477000n, currency: 'PLN' },
  planned: { amountMinor: 1180000n, currency: 'PLN' },
  fraction: 0.404,
};

const CATEGORIES = [
  { id: 'c1', name: 'Groceries' },
  { id: 'c2', name: 'Transport' },
];

const SUGGESTIONS: Readonly<Record<string, string>> = {
  'p-food': 'Eating out',
  'p-transport': 'Transport',
  'p-groceries': 'Groceries',
};

function tx(
  id: string,
  occurredOn: string,
  title: string,
  minor: bigint,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    accountId: 'acc-1',
    occurredOn,
    amount: { amountMinor: minor, currency: 'PLN' },
    description: title,
    merchant: title,
    source: 'bank_sync',
    status: 'booked',
    suggestedPlannedItemId: null,
    isTransfer: false,
    ignored: false,
    notes: null,
    mapping: null,
    ...extra,
  };
}

function mapped(categoryName: string, by: 'manual' | 'rule' = 'rule'): Transaction['mapping'] {
  return {
    plannedItemId: `p-${categoryName}`,
    planName: 'October',
    planArchived: false,
    categoryName,
    by,
  };
}

function noop(): void {
  return undefined;
}

function suggestionLabelOf(row: Transaction): string | undefined {
  return row.suggestedPlannedItemId === null ? undefined : SUGGESTIONS[row.suggestedPlannedItemId];
}

function View({
  rows,
  status = 'ready',
  filters = NO_FILTERS,
  month = OCTOBER,
}: {
  rows: Transaction[];
  status?: TransactionListStatus;
  filters?: TransactionFilters;
  month?: MonthLeft;
}): React.JSX.Element {
  const props: TransactionListViewProps = {
    month,
    filters,
    onFiltersChange: noop,
    categories: CATEGORIES,
    status,
    onRetry: noop,
    groups: groupByDay(rows),
    sorting: sortingProgress(rows),
    suggestionLabelOf,
    selectedIds: new Set<string>(),
    onToggleRow: noop,
    onToggleAll: noop,
    onAdd: noop,
    onRowClick: noop,
    onRowMap: noop,
    onConfirmSuggestion: noop,
  };

  return <TransactionListView {...props} />;
}

/** Booked and just-in rows grouped by day, with the month rod and the sorting panel. */
export function TransactionListLive(): React.JSX.Element {
  return (
    <View
      rows={[
        tx('t1', '2026-10-22', 'Pyszne.pl', -7250n, {
          status: 'live',
          mapping: mapped('Eating out'),
        }),
        tx('t2', '2026-10-22', 'Lidl', -8740n, { mapping: mapped('Groceries') }),
        tx('t3', '2026-10-21', 'Decathlon', -22000n, { mapping: mapped('Sport', 'manual') }),
        tx('t4', '2026-10-21', 'PKP Intercity', -11900n, { mapping: mapped('Transport') }),
        tx('t5', '2026-10-20', 'Apteka Gemini', -8990n, { mapping: mapped('Health') }),
      ]}
    />
  );
}

/** A pending bank row waiting to be booked. */
export function TransactionListPending(): React.JSX.Element {
  return (
    <View
      rows={[
        tx('t1', '2026-10-22', 'Biedronka', -14980n, {
          status: 'pending',
          mapping: mapped('Groceries'),
        }),
        tx('t2', '2026-10-21', 'Bistro Charlotte', -9600n, { mapping: mapped('Eating out') }),
      ]}
    />
  );
}

/** A row in another currency keeps its own amount. */
export function TransactionListEur(): React.JSX.Element {
  return (
    <View
      rows={[
        {
          ...tx('t1', '2026-10-22', 'Bolt', -1240n, { mapping: mapped('Transport') }),
          amount: { amountMinor: -1240n, currency: 'EUR' },
        },
        tx('t2', '2026-10-22', 'Lidl', -8740n, { mapping: mapped('Groceries') }),
      ]}
    />
  );
}

/** Transfers between own accounts are neutral rows. */
export function TransactionListTransfer(): React.JSX.Element {
  return (
    <View
      rows={[
        tx('t1', '2026-10-22', 'Marek to Anna BLIK', -100000n, { isTransfer: true }),
        tx('t2', '2026-10-21', 'Wise top-up', -40000n, { isTransfer: true }),
        tx('t3', '2026-10-21', 'Lidl', -8740n, { mapping: mapped('Groceries') }),
      ]}
    />
  );
}

/** Unmapped rows offer the suggestion with Confirm, or Choose when there is none. */
export function TransactionListToSort(): React.JSX.Element {
  return (
    <View
      rows={[
        tx('t1', '2026-10-22', 'Bolt', -2450n, { suggestedPlannedItemId: 'p-transport' }),
        tx('t2', '2026-10-22', 'Żabka', -1890n, { suggestedPlannedItemId: 'p-groceries' }),
        tx('t3', '2026-10-21', 'Orlen', -21000n),
        tx('t4', '2026-10-20', 'Lidl', -8740n, { mapping: mapped('Groceries') }),
      ]}
    />
  );
}

/** Nothing yet: no filters set, and no plan for the month rod. */
export function TransactionListEmpty(): React.JSX.Element {
  return <View rows={[]} month={undefined} />;
}

/** The first page is loading. */
export function TransactionListLoading(): React.JSX.Element {
  return <View rows={[]} status="loading" />;
}

/** The first page failed; Try again reloads it. */
export function TransactionListError(): React.JSX.Element {
  return <View rows={[]} status="error" />;
}

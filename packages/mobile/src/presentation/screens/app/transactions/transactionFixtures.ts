import type { TxRowData } from '@power-budget/shared-app';
import type {
  DayGroup,
  MonthSummary,
  TransactionListRow,
} from '../../../../infrastructure/transactions/TransactionListModel.js';
import type { TransactionView } from '../../../../infrastructure/transactions/TransactionView.js';
import type { PlannedItemOption } from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import type { TransactionListViewProps } from './TransactionListView.js';

/** Fixture data shared by the View tests and the gallery entries. */

function data(overrides: Partial<TxRowData> & Pick<TxRowData, 'id' | 'title'>): TxRowData {
  return { subtitle: '', amountMinor: -4200n, currency: 'PLN', status: 'booked', ...overrides };
}

export const LIDL: TransactionListRow = {
  data: data({ id: 'lidl', title: 'Lidl', subtitle: 'Groceries', amountMinor: -14980n }),
  day: '2026-10-27',
  kind: 'sorted',
  live: false,
  suggestedPlannedItemId: null,
};

export const ZABKA: TransactionListRow = {
  data: data({
    id: 'zabka',
    title: 'Żabka',
    amountMinor: -2350n,
    status: 'to-sort',
    suggestionLabel: 'Groceries',
    suggestionConfidence: 0.86,
  }),
  day: '2026-10-27',
  kind: 'toSort',
  live: true,
  provenance: 'bank',
  suggestedPlannedItemId: 'item-groceries',
};

export const ORLEN: TransactionListRow = {
  data: data({ id: 'orlen', title: 'Orlen', amountMinor: -21000n, status: 'to-sort' }),
  day: '2026-10-26',
  kind: 'toSort',
  live: false,
  suggestedPlannedItemId: null,
};

export const SAVINGS: TransactionListRow = {
  data: data({ id: 'savings', title: 'To savings', amountMinor: -50000n, status: 'transfer' }),
  day: '2026-10-26',
  kind: 'transfer',
  live: false,
  suggestedPlannedItemId: null,
};

export const BIEDRONKA: TransactionListRow = {
  data: data({
    id: 'biedronka',
    title: 'Biedronka',
    subtitle: 'Groceries',
    amountMinor: -6120n,
    status: 'pending',
  }),
  day: '2026-10-25',
  kind: 'sorted',
  live: false,
  provenance: 'manual',
  suggestedPlannedItemId: null,
};

export const ALL_ROWS: readonly TransactionListRow[] = [LIDL, ZABKA, ORLEN, SAVINGS, BIEDRONKA];

export const GROUPS: readonly DayGroup[] = [
  { day: '2026-10-27', rows: [ZABKA, LIDL] },
  { day: '2026-10-26', rows: [ORLEN, SAVINGS] },
  { day: '2026-10-25', rows: [BIEDRONKA] },
];

export const MONTH_UNDER: MonthSummary = {
  periodStart: '2026-10-01',
  left: { amountMinor: 184200n, currency: 'PLN' },
  planned: { amountMinor: 420000n, currency: 'PLN' },
  fraction: 0.44,
  state: 'under',
};

export const MONTH_OVER: MonthSummary = {
  periodStart: '2026-10-01',
  left: { amountMinor: -32000n, currency: 'PLN' },
  planned: { amountMinor: 420000n, currency: 'PLN' },
  fraction: 0,
  state: 'over',
};

function noop(): void {
  // Fixture handlers do nothing; tests pass their own spies.
}

export const LIST_PROPS: TransactionListViewProps = {
  status: 'ready',
  month: MONTH_UNDER,
  waiting: { amountMinor: 23350n, currency: 'PLN' },
  filter: 'all',
  counts: { all: 5, toSort: 2, sorted: 2, transfers: 1 },
  onFilterChange: noop,
  groups: GROUPS,
  appliedIds: new Set<string>(),
  onOpen: noop,
  onConfirm: noop,
  onUndo: noop,
  onChoose: noop,
  onSortAll: noop,
};

export const OPTIONS: readonly PlannedItemOption[] = [
  { plannedItemId: 'item-groceries', planName: 'October', categoryName: 'Groceries' },
  { plannedItemId: 'item-fuel', planName: 'October', categoryName: 'Fuel' },
];

export const DETAIL: TransactionView = {
  id: 'orlen',
  occurredOn: '2026-10-26',
  description: 'ORLEN STACJA 1234',
  merchant: 'Orlen',
  amount: { amountMinor: '-21000', currency: 'PLN' },
  source: 'bank_sync',
  notes: null,
  ignored: false,
  isTransfer: false,
  mapping: null,
  suggestedPlannedItemId: null,
};

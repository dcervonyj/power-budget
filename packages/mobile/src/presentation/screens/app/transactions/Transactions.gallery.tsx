import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import { TransactionDetailView } from './TransactionDetailView.js';
import type { TransactionDetailViewProps } from './TransactionDetailView.js';
import { TransactionListView } from './TransactionListView.js';
import type { TransactionListViewProps } from './TransactionListView.js';
import { DETAIL, GROUPS, LIST_PROPS, MONTH_OVER, OPTIONS, ZABKA } from './transactionFixtures.js';

const useStyles = makeStyles(() => ({
  stage: { height: 980, overflow: 'hidden' },
  // Nothing to focus in a skeleton: keep it shorter than the viewport so the page does not scroll.
  short: { height: 600, overflow: 'hidden' },
}));

const DETAIL_PROPS: TransactionDetailViewProps = {
  status: 'ready',
  transaction: DETAIL,
  options: OPTIONS,
  pickerOpen: false,
  notes: '',
  saving: false,
  onRetry: noop,
  onOpenPicker: noop,
  onClosePicker: noop,
  onPickItem: noop,
  onClearMapping: noop,
  onToggleTransfer: noop,
  onNotesChange: noop,
  onSaveNotes: noop,
};

function Stage({
  children,
  short = false,
}: {
  readonly children: React.ReactNode;
  readonly short?: boolean;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={short ? styles.short : styles.stage}>{children}</View>
    </ShellBackground>
  );
}

function list(overrides: Partial<TransactionListViewProps>): React.JSX.Element {
  return (
    <Stage>
      <TransactionListView {...LIST_PROPS} {...overrides} />
    </Stage>
  );
}

function detail(overrides: Partial<TransactionDetailViewProps>, short = false): React.JSX.Element {
  return (
    <Stage short={short}>
      <TransactionDetailView {...DETAIL_PROPS} {...overrides} />
    </Stage>
  );
}

/** The month rod, the filter chips and the day groups with a suggestion to confirm. */
export function ListToSort(): React.JSX.Element {
  return list({});
}

/** A suggestion just accepted: the row shows Undo and the counts move to Sorted. */
export function ListSuggestionApplied(): React.JSX.Element {
  return list({
    appliedIds: new Set([ZABKA.data.id]),
    waiting: { amountMinor: 21000n, currency: 'PLN' },
    counts: { all: 5, toSort: 1, sorted: 3, transfers: 1 },
  });
}

/** The month is overspent: the rod turns over and the line says by how much. */
export function ListMonthOver(): React.JSX.Element {
  return list({ month: MONTH_OVER });
}

/** No active plan: the month panel stays out. */
export function ListWithoutPlan(): React.JSX.Element {
  return list({ month: undefined, waiting: undefined });
}

/** Only transfers, with the note that they are not spending. */
export function ListTransfersFilter(): React.JSX.Element {
  return list({ filter: 'transfers', groups: [GROUPS[1] ?? { day: '2026-10-26', rows: [] }] });
}

export function ListLoading(): React.JSX.Element {
  return list({ status: 'loading', groups: [] });
}

export function ListError(): React.JSX.Element {
  return list({ status: 'error', groups: [], onRetry: noop });
}

export function ListEmpty(): React.JSX.Element {
  return list({
    groups: [],
    counts: { all: 0, toSort: 0, sorted: 0, transfers: 0 },
    month: undefined,
  });
}

/** A transaction that is not sorted yet. */
export function DetailToSort(): React.JSX.Element {
  return detail({});
}

/** A sorted transaction with its category and notes. */
export function DetailSorted(): React.JSX.Element {
  return detail({
    transaction: { ...DETAIL, mapping: { plannedItemId: 'item-fuel' }, notes: 'Road trip' },
    categoryName: 'Fuel',
    notes: 'Road trip',
  });
}

/** A transfer between the user's own accounts. */
export function DetailTransfer(): React.JSX.Element {
  return detail({ transaction: { ...DETAIL, isTransfer: true } });
}

/** The category sheet open over the detail. */
export function DetailCategorySheet(): React.JSX.Element {
  return detail({ pickerOpen: true });
}

export function DetailLoading(): React.JSX.Element {
  return detail({ status: 'loading', transaction: undefined }, true);
}

export function DetailError(): React.JSX.Element {
  return detail({ status: 'error', transaction: undefined });
}

function noop(): void {
  // Gallery handlers do nothing.
}

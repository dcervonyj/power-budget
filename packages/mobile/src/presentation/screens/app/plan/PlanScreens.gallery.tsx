import React from 'react';
import { View } from 'react-native';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import { makeStyles } from '../../../theme/index.js';
import { PlanEditorView, type PlanEditorViewProps } from './PlanEditorView.js';
import { PlansListView, type PlansListViewProps } from './PlansListView.js';
import type { PlanItemRowModel } from './planModels.js';

// Sample data of the D7 spec: October 2026, income 14 200, planned 11 800.
function plan(id: string, name: string, start: string, end: string, archived = false): PlanDto {
  return {
    id,
    name,
    type: 'household',
    ownerUserId: 'user-anna',
    periodKind: 'monthly',
    period: { start, end },
    baseCurrency: 'PLN',
    archivedAt: archived ? '2026-10-01T00:00:00.000Z' : null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const OCTOBER = plan('plan-oct', 'October', '2026-10-01', '2026-10-31');
const PLANS: readonly PlanDto[] = [
  OCTOBER,
  plan('plan-nov', 'November', '2026-11-01', '2026-11-30'),
  plan('plan-sep', 'September', '2026-09-01', '2026-09-30', true),
];

function row(
  id: string,
  name: string,
  direction: PlanItemRowModel['direction'],
  minor: string,
  spentMinor: bigint | null,
): PlanItemRowModel {
  return {
    id,
    name,
    direction,
    amountMinor: minor,
    currency: 'PLN',
    amountInput: `${minor.slice(0, -2)}.${minor.slice(-2)}`,
    spentMinor,
  };
}

const INCOME: readonly PlanItemRowModel[] = [
  row('i-anna', 'Anna salary', 'income', '840000', null),
  row('i-marek', 'Marek salary', 'income', '460000', null),
  row('i-free', 'Marek freelance', 'income', '120000', null),
];

const LIMITS: readonly PlanItemRowModel[] = [
  row('l-rent', 'Rent', 'expense', '340000', 340000n),
  row('l-food', 'Groceries', 'expense', '220000', 114864n),
  row('l-out', 'Eating out', 'expense', '50000', 56250n),
  row('l-bills', 'Bills & insurance', 'expense', '100000', 54800n),
  row('l-transport', 'Transport', 'expense', '70000', 31239n),
];

const useStyles = makeStyles(() => ({
  list: { height: 720 },
  editor: { height: 2300 },
  editorShort: { height: 1500 },
}));

function noop(): void {
  // Gallery fixtures do not react to input.
}

const LIST: PlansListViewProps = {
  plans: PLANS,
  loading: false,
  refreshing: false,
  error: null,
  creating: false,
  onCreate: noop,
  onOpen: noop,
  onRefresh: noop,
  onRetry: noop,
};

const EDITOR: PlanEditorViewProps = {
  plan: OCTOBER,
  totals: {
    currency: 'PLN',
    incomeMinor: 1420000n,
    expensesMinor: 1180000n,
    leftMinor: 240000n,
    excludedCount: 0,
  },
  income: INCOME,
  limits: LIMITS,
  draft: { categoryId: '', direction: 'expense', amount: '' },
  draftCategories: [
    { value: 'cat-home', label: 'Home' },
    { value: 'cat-health', label: 'Health' },
  ],
  saving: false,
  saveError: null,
  onNameChange: noop,
  onBaseCurrencyChange: noop,
  onCustomDatesChange: noop,
  onDraftChange: noop,
  onAddItem: noop,
  onSave: noop,
  onArchive: noop,
  onAmountChange: noop,
  onRemove: noop,
};

function Stage({
  height,
  children,
}: {
  readonly height: 'list' | 'editor' | 'editorShort';
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={styles[height]}>{children}</View>
    </ShellBackground>
  );
}

/** Plans list: active and archived plans. */
export function PlansList(): React.JSX.Element {
  return (
    <Stage height="list">
      <PlansListView {...LIST} />
    </Stage>
  );
}

/** Plans list with no plans. */
export function PlansListEmpty(): React.JSX.Element {
  return (
    <Stage height="list">
      <PlansListView {...LIST} plans={[]} />
    </Stage>
  );
}

/** Plans list that failed to load. */
export function PlansListError(): React.JSX.Element {
  return (
    <Stage height="list">
      <PlansListView {...LIST} plans={[]} error="Could not load plans. Please try again." />
    </Stage>
  );
}

/** Plan editor: totals, details, income, category limits with steppers, new item form. */
export function PlanEditor(): React.JSX.Element {
  return (
    <Stage height="editor">
      <PlanEditorView {...EDITOR} />
    </Stage>
  );
}

/** Plan editor with limits above income (Over income) and a save error. */
export function PlanEditorOverIncome(): React.JSX.Element {
  return (
    <Stage height="editor">
      <PlanEditorView
        {...EDITOR}
        totals={{
          ...EDITOR.totals,
          expensesMinor: 1560000n,
          leftMinor: -140000n,
          excludedCount: 2,
        }}
        saveError="Could not update the item."
      />
    </Stage>
  );
}

/** Plan editor of a new plan with no items. */
export function PlanEditorEmpty(): React.JSX.Element {
  return (
    <Stage height="editorShort">
      <PlanEditorView
        {...EDITOR}
        totals={{ ...EDITOR.totals, incomeMinor: 0n, expensesMinor: 0n, leftMinor: 0n }}
        income={[]}
        limits={[]}
      />
    </Stage>
  );
}

import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import { AddExpenseView } from './AddExpenseView.js';
import type { AddExpenseViewProps } from './AddExpenseView.js';
import { FIXTURE_ACCOUNTS, FIXTURE_CATEGORIES, FIXTURE_PLAN } from './addExpenseFixture.js';

const useStyles = makeStyles(() => ({
  stage: { height: 844, overflow: 'hidden' },
}));

const BASE: AddExpenseViewProps = {
  plan: FIXTURE_PLAN,
  currency: 'PLN',
  dateLabel: '22 Oct',
  typed: '84.00',
  categories: FIXTURE_CATEGORIES,
  categoryId: 'groceries',
  accounts: FIXTURE_ACCOUNTS,
  accountId: 'pko',
  status: 'editing',
  error: null,
  onTypedChange: ignore,
  onCategoryChange: ignore,
  onAccountChange: ignore,
  onSave: ignore,
  onUndo: ignore,
  onAddAnother: ignore,
  onBackToToday: ignore,
};

function Stage(overrides: Partial<AddExpenseViewProps>): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={styles.stage}>
        <AddExpenseView {...BASE} {...overrides} />
      </View>
    </ShellBackground>
  );
}

/** 84,00 in Groceries: safe to spend 477 to 468,60 a day. */
export function Typed(): React.JSX.Element {
  return Stage({});
}

/** Nothing typed yet: the Save key is disabled. */
export function EmptyAmount(): React.JSX.Element {
  return Stage({ typed: '' });
}

/** Eating out is already over its plan: the line and rod show the overshoot. */
export function CategoryOver(): React.JSX.Element {
  return Stage({ typed: '120', categoryId: 'eating' });
}

/** More than the month has left: the over-plan tag and an empty lens. */
export function OverPlan(): React.JSX.Element {
  return Stage({ typed: '5000' });
}

/** Unplanned bucket: no rod, "outside the plan". */
export function Unplanned(): React.JSX.Element {
  return Stage({ typed: '49.99', categoryId: 'unplanned' });
}

/** Saved: Added tag, the new safe to spend, Undo and Add another. */
export function Saved(): React.JSX.Element {
  return Stage({ status: 'saved' });
}

/** A failed save keeps the keypad and shows the error. */
export function SaveFailed(): React.JSX.Element {
  return Stage({ error: 'Could not save the expense. Try again.' });
}

function ignore(): void {}

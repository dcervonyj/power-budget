import React from 'react';
import type { CategoryRowData, TxRowData } from '@power-budget/shared-app';
import { View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { CategoryRow } from './CategoryRow.js';
import { TxRow } from './TxRow.js';

const useStyles = makeStyles((glass) => ({
  column: { gap: glass.space.md },
}));

function tx(overrides: Partial<TxRowData> & Pick<TxRowData, 'id' | 'title'>): TxRowData {
  return {
    subtitle: 'Today, PKO BP ··4821',
    amountMinor: -14980n,
    currency: 'PLN',
    status: 'booked',
    payer: 'Anna Kowalska',
    ...overrides,
  };
}

function category(
  overrides: Partial<CategoryRowData> & Pick<CategoryRowData, 'id' | 'label'>,
): CategoryRowData {
  return {
    spentMinor: 114864n,
    plannedMinor: 220000n,
    currency: 'PLN',
    status: 'ok',
    paid: false,
    ...overrides,
  };
}

/** Booked, live (just synced) and pending rows. */
export function TxRowStates(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.column}>
      <TxRow transaction={tx({ id: '1', title: 'Lidl', subtitle: '18 Oct, Groceries' })} />
      <TxRow
        transaction={tx({ id: '2', title: 'Pyszne.pl', amountMinor: -7250n, payer: 'Marek Nowak' })}
        live
        provenance="bank"
        onPress={noop}
      />
      <TxRow
        transaction={tx({ id: '3', title: 'Biedronka', status: 'pending' })}
        provenance="manual"
      />
    </View>
  );
}

/** Transfers are neutral: dim amount, a Transfer tag, never spending. */
export function TxRowTransfer(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.column}>
      <TxRow
        transaction={tx({
          id: '4',
          title: 'Marek to Anna, BLIK',
          subtitle: '18 Oct',
          amountMinor: 100000n,
          status: 'transfer',
          payer: 'Marek Nowak',
        })}
      />
      <TxRow
        transaction={tx({
          id: '5',
          title: 'Wise top-up',
          subtitle: '16 Oct',
          amountMinor: 40000n,
          status: 'transfer',
        })}
      />
    </View>
  );
}

/** To sort: suggestion with Confirm and Choose, then the accepted state with Undo. */
export function TxRowToSort(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.column}>
      <TxRow
        transaction={tx({
          id: '6',
          title: 'Bolt',
          amountMinor: -1240n,
          currency: 'EUR',
          originalAmountMinor: -5310n,
          originalCurrency: 'PLN',
          suggestionLabel: 'Transport',
          suggestionConfidence: 0.81,
          status: 'to-sort',
          subtitle: 'Today 14:51, Wise EUR card',
        })}
        provenance="rule"
        onConfirmSuggestion={noop}
        onChooseCategory={noop}
      />
      <TxRow
        transaction={tx({
          id: '7',
          title: 'Żabka',
          amountMinor: -1890n,
          suggestionLabel: 'Groceries',
          status: 'to-sort',
          subtitle: 'Today 14:49',
        })}
        suggestionApplied
        onUndoSuggestion={noop}
      />
      <TxRow
        transaction={tx({
          id: '8',
          title: 'Orlen',
          amountMinor: -12930n,
          status: 'to-sort',
          payer: 'Marek Nowak',
          subtitle: '19 Oct, PKO BP ··2290',
        })}
        onChooseCategory={noop}
      />
    </View>
  );
}

/** Category rows: under plan, nearly empty, over, paid and nothing left. */
export function CategoryRowStates(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.column}>
      <CategoryRow index={0} category={category({ id: 'a', label: 'Groceries' })} onPress={noop} />
      <CategoryRow
        index={1}
        category={category({
          id: 'b',
          label: 'Transport',
          spentMinor: 66000n,
          plannedMinor: 70000n,
          forecastMinor: 78000n,
        })}
      />
      <CategoryRow
        index={2}
        category={category({
          id: 'c',
          label: 'Eating out',
          spentMinor: 56250n,
          plannedMinor: 50000n,
          status: 'over',
        })}
      />
      <CategoryRow
        index={3}
        category={category({
          id: 'd',
          label: 'Rent',
          spentMinor: 340000n,
          plannedMinor: 340000n,
          status: 'neutral',
          paid: true,
        })}
      />
      <CategoryRow
        index={4}
        category={category({ id: 'e', label: 'Home', spentMinor: 90000n, plannedMinor: 90000n })}
      />
    </View>
  );
}

/** Privacy variant: only the total spent, no plan, no rod, no amount left. */
export function CategoryRowPrivacy(): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.column}>
      <CategoryRow
        category={category({
          id: 'f',
          label: 'Marek, personal',
          spentMinor: 18160n,
          plannedMinor: 120000n,
          totalOnly: true,
        })}
      />
    </View>
  );
}

function noop(): void {}

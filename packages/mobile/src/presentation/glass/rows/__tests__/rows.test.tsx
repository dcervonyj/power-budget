import React from 'react';
import { StyleSheet } from 'react-native';
import { glassDarkTheme } from '@power-budget/design-tokens/glass';
import { screen, userEvent, within } from '@testing-library/react-native';
import type { CategoryRowData, TxRowData } from '@power-budget/shared-app';
import { CategoryRow } from '../CategoryRow.js';
import { TxRow } from '../TxRow.js';
import { LOCALES, MESSAGES, plain, renderGlass } from '../../atoms/__tests__/glassTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const BASE: TxRowData = {
  id: 'tx-1',
  title: 'Lidl',
  subtitle: '18 Oct',
  amountMinor: -8740n,
  currency: 'PLN',
  status: 'booked',
};
const TO_SORT: TxRowData = { ...BASE, status: 'to-sort', suggestionLabel: 'Groceries' };
const CATEGORY: CategoryRowData = {
  id: 'cat-1',
  label: 'Groceries',
  spentMinor: 114864n,
  plannedMinor: 220000n,
  currency: 'PLN',
  status: 'ok',
  paid: false,
};

function txName(): string {
  return plain(screen.getByTestId('tx-row').props.accessibilityLabel as string);
}

function categoryName(): string {
  return plain(screen.getByTestId('category-row').props.accessibilityLabel as string);
}

describe('TxRow accessible names', () => {
  it('names a booked row by title, amount and subtitle, with no tag', async () => {
    await renderGlass(<TxRow transaction={BASE} />);

    expect(txName()).toMatch(/^Lidl, .*87[.,]40.*, 18 Oct$/);
    expect(screen.queryByTestId('status-tag')).toBeNull();
  });

  it('adds "just synced" for a live row and shows the Just in tag', async () => {
    await renderGlass(<TxRow transaction={BASE} live />);

    expect(txName()).toContain('just synced');
    expect(screen.getByText('Just in')).toBeTruthy();
  });

  it('names a pending row and shows the Pending tag', async () => {
    await renderGlass(<TxRow transaction={{ ...BASE, status: 'pending' }} />);

    expect(txName()).toContain('pending');
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('names a transfer, tags it and renders its amount dim', async () => {
    await renderGlass(
      <TxRow transaction={{ ...BASE, status: 'transfer', amountMinor: 100000n }} />,
    );
    const amount = within(screen.getByTestId('tx-amount')).getByTestId('amount-text');

    expect(txName()).toContain('transfer');
    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(StyleSheet.flatten(amount.props.style)?.color).toBe(glassDarkTheme.color.dim);
  });

  it('names a to-sort row with its suggestion and shows the percentage', async () => {
    await renderGlass(<TxRow transaction={{ ...TO_SORT, suggestionConfidence: 0.88 }} />);

    expect(txName()).toContain('to sort, suggested Groceries');
    expect(screen.getByText('Suggested: Groceries 88%')).toBeTruthy();
    expect(screen.getByText('To sort')).toBeTruthy();
  });

  it('names a to-sort row without a suggestion', async () => {
    await renderGlass(<TxRow transaction={{ ...BASE, status: 'to-sort' }} />);

    expect(txName()).toContain('to sort, no suggestion');
  });

  it.each([
    ['bank', 'From bank'],
    ['manual', 'Added by hand'],
    ['rule', 'By rule'],
  ] as const)('shows the %s provenance tag', async (provenance, label) => {
    await renderGlass(<TxRow transaction={BASE} provenance={provenance} />);

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows the original amount hidden from assistive tech', async () => {
    await renderGlass(
      <TxRow
        transaction={{
          ...BASE,
          currency: 'EUR',
          originalAmountMinor: -5310n,
          originalCurrency: 'PLN',
        }}
      />,
    );

    expect(screen.getAllByTestId('amount-text')).toHaveLength(1);
    expect(screen.getAllByTestId('amount-text', { includeHiddenElements: true })).toHaveLength(2);
  });

  it.each([
    ['without an original amount', { originalCurrency: 'PLN' }],
    ['without an original currency', { originalAmountMinor: -5310n }],
  ] as const)('shows no original amount %s', async (_name, original) => {
    await renderGlass(<TxRow transaction={{ ...BASE, currency: 'EUR', ...original }} />);

    expect(screen.getAllByTestId('amount-text', { includeHiddenElements: true })).toHaveLength(1);
  });
});

describe('TxRow actions', () => {
  it('calls confirm and choose with the transaction id', async () => {
    const onConfirm = jest.fn();
    const onChoose = jest.fn();
    await renderGlass(
      <TxRow transaction={TO_SORT} onConfirmSuggestion={onConfirm} onChooseCategory={onChoose} />,
    );
    const user = userEvent.setup();

    await user.press(
      screen.getByRole('button', { name: 'Confirm the suggested category for Lidl' }),
    );
    await user.press(screen.getByRole('button', { name: 'Choose a category for Lidl' }));

    expect(onConfirm).toHaveBeenCalledWith('tx-1');
    expect(onChoose).toHaveBeenCalledWith('tx-1');
  });

  it('shows Undo instead of Confirm once the suggestion is applied', async () => {
    const onUndo = jest.fn();
    await renderGlass(<TxRow transaction={TO_SORT} suggestionApplied onUndoSuggestion={onUndo} />);

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Undo the category for Lidl' }));

    expect(onUndo).toHaveBeenCalledWith('tx-1');
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
    expect(screen.getByText('Sorted into Groceries')).toBeTruthy();
  });

  it('offers only Choose when there is no suggestion', async () => {
    const onChoose = jest.fn();
    await renderGlass(
      <TxRow transaction={{ ...BASE, status: 'to-sort' }} onChooseCategory={onChoose} />,
    );

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Choose a category for Lidl' }));

    expect(onChoose).toHaveBeenCalledWith('tx-1');
    expect(screen.queryByRole('button', { name: /Confirm/ })).toBeNull();
  });

  it('opens the transaction from the main button', async () => {
    const onPress = jest.fn();
    await renderGlass(<TxRow transaction={BASE} onPress={onPress} />);

    await userEvent.setup().press(screen.getByRole('button', { name: /Lidl/ }));

    expect(onPress).toHaveBeenCalledWith('tx-1');
  });

  it('has no buttons on a booked row without callbacks', async () => {
    await renderGlass(<TxRow transaction={BASE} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('CategoryRow', () => {
  it('shows the rod, the amount left and the status tag', async () => {
    await renderGlass(<CategoryRow category={CATEGORY} />);

    expect(categoryName()).toMatch(/^Groceries: .*1[ ,]148[.,]64.* spent$/);
    expect(screen.getByRole('image').props.accessibilityLabel).toContain('left of');
    expect(within(screen.getByTestId('category-left')).getByText(/left/)).toBeTruthy();
    expect(screen.getByText('Under plan')).toBeTruthy();
  });

  it('shows the over state with an over-by tag', async () => {
    await renderGlass(
      <CategoryRow
        category={{ ...CATEGORY, spentMinor: 56250n, plannedMinor: 50000n, status: 'over' }}
      />,
    );

    expect(within(screen.getByTestId('rod-tag')).getByText(/^Over by/)).toBeTruthy();
    expect(screen.getByRole('image').props.accessibilityLabel).toContain('over by');
    expect(screen.queryByText('Under plan')).toBeNull();
  });

  it('shows the paid state', async () => {
    await renderGlass(
      <CategoryRow
        category={{ ...CATEGORY, spentMinor: 340000n, plannedMinor: 340000n, paid: true }}
      />,
    );

    expect(within(screen.getByTestId('rod-tag')).getByText('Paid')).toBeTruthy();
  });

  it('shows the forecast when given', async () => {
    await renderGlass(<CategoryRow category={{ ...CATEGORY, forecastMinor: 230000n }} />);

    expect(screen.getByText(/at this pace/)).toBeTruthy();
  });

  it('shows only the total spent in privacy mode: no rod, no plan, no amount left', async () => {
    await renderGlass(<CategoryRow category={{ ...CATEGORY, totalOnly: true }} />);

    expect(categoryName()).toContain('totals only');
    expect(screen.getByText('Spent in total')).toBeTruthy();
    expect(screen.getByText('Totals only')).toBeTruthy();
    expect(screen.queryByTestId('rod')).toBeNull();
    expect(screen.queryByTestId('category-left')).toBeNull();
    expect(screen.queryByText(/^of /)).toBeNull();
  });

  it('presses with the category id', async () => {
    const onPress = jest.fn();
    await renderGlass(<CategoryRow category={CATEGORY} onPress={onPress} />);

    await userEvent.setup().press(screen.getByRole('button', { name: /Groceries/ }));

    expect(onPress).toHaveBeenCalledWith('cat-1');
  });
});

describe.each(LOCALES.filter((locale) => locale !== 'en'))('rows in %s', (locale) => {
  const messages = MESSAGES[locale];

  it('translates the tx tags, suggestion text and action labels', async () => {
    const onConfirm = jest.fn();
    await renderGlass(
      <TxRow
        transaction={{ ...TO_SORT, suggestionConfidence: 0.5 }}
        provenance="rule"
        onConfirmSuggestion={onConfirm}
        onChooseCategory={jest.fn()}
      />,
      locale,
    );

    expect(screen.getByText(messages['glass-rows.tx.status.toSort'] ?? '')).toBeTruthy();
    expect(screen.getByText(messages['glass-rows.tx.provenance.rule'] ?? '')).toBeTruthy();
    expect(screen.getByText(messages['glass-rows.tx.confirm'] ?? '')).toBeTruthy();
    expect(screen.getByText(messages['glass-rows.tx.choose'] ?? '')).toBeTruthy();
    expect(screen.getByText(/50%/)).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: (messages['glass-rows.tx.confirm.aria'] ?? '').replace('{title}', 'Lidl'),
      }),
    ).toBeTruthy();
    expect(txName()).not.toMatch(/to sort/);
  });

  it('translates the category row', async () => {
    await renderGlass(<CategoryRow category={CATEGORY} />, locale);

    expect(screen.getByText(messages['glass-rows.category.underPlan'] ?? '')).toBeTruthy();
    expect(categoryName()).not.toContain('spent');
  });
});

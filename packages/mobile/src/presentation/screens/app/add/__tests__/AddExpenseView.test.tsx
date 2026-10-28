import React from 'react';
import { screen, userEvent, within } from '@testing-library/react-native';
import { plain } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import { renderAdd } from './renderAdd.js';
import { AddExpenseView } from '../AddExpenseView.js';
import type { AddExpenseViewProps } from '../AddExpenseView.js';
import { FIXTURE_ACCOUNTS, FIXTURE_CATEGORIES, FIXTURE_PLAN } from '../addExpenseFixture.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function props(overrides: Partial<AddExpenseViewProps> = {}): AddExpenseViewProps {
  return {
    plan: FIXTURE_PLAN,
    currency: 'PLN',
    dateLabel: '22 Oct',
    typed: '',
    categories: FIXTURE_CATEGORIES,
    categoryId: 'groceries',
    accounts: FIXTURE_ACCOUNTS,
    accountId: 'pko',
    unsorted: false,
    status: 'editing',
    error: null,
    onTypedChange: jest.fn(),
    onCategoryChange: jest.fn(),
    onAccountChange: jest.fn(),
    onSave: jest.fn(),
    onUndo: jest.fn(),
    onAddAnother: jest.fn(),
    onRetryRefresh: jest.fn(),
    onRetryCategory: jest.fn(),
    onBackToToday: jest.fn(),
    ...overrides,
  };
}

/** Types the digits of `value` through the real keypad so the maths is driven by key presses. */
function Typing({
  initial,
  ...rest
}: AddExpenseViewProps & { initial: string }): React.JSX.Element {
  const [typed, setTyped] = React.useState(initial);

  return <AddExpenseView {...rest} typed={typed} onTypedChange={setTyped} />;
}

function text(testID: string): string {
  const node = screen.getByTestId(testID);

  return plain(
    [node.props.children]
      .flat(Infinity)
      .filter((part) => typeof part === 'string')
      .join(''),
  );
}

describe('AddExpenseView keypad maths', () => {
  it('shows 477 to 468,60 a day after typing 84,00 with the fixture', async () => {
    await renderAdd(<Typing {...props()} initial="" />, 'pl');
    const user = userEvent.setup();

    for (const key of ['8', '4', ',', '0', '0']) {
      await user.press(screen.getByRole('button', { name: key }));
    }

    expect(text('add-amount')).toBe('84,00');
    expect(text('add-safe-after')).toBe('468,60 zł');
    expect(screen.getByText(/477,00 zł →/)).toBeTruthy();
  });

  it('shows the category line before and after in English', async () => {
    await renderAdd(<AddExpenseView {...props({ typed: '84.00' })} />);

    expect(text('add-category-line')).toBe('PLN 1,051.36 → PLN 967.36 left');
  });

  it('empties the lens and flags the plan when the amount passes what the month has left', async () => {
    await renderAdd(<AddExpenseView {...props({ typed: '5000' })} />, 'pl');

    expect(text('add-safe-after')).toBe('0,00 zł');
    expect(screen.getByText(/230,00 zł więcej, niż zostało w planie October/)).toBeTruthy();
  });

  it('marks a category that crosses its plan', async () => {
    await renderAdd(<AddExpenseView {...props({ typed: '120', categoryId: 'eating' })} />, 'pl');

    expect(text('add-category-line')).toBe('Przekroczenie o 62,50 zł → 182,50 zł');
  });

  it('leaves the lens out when today is outside the plan period', async () => {
    await renderAdd(<AddExpenseView {...props({ plan: null, typed: '10' })} />);

    expect(screen.queryByTestId('add-safe-after')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add PLN 10.00 to Groceries' })).toBeTruthy();
  });
});

describe('AddExpenseView actions', () => {
  it('keeps Save disabled until an amount is typed', async () => {
    await renderAdd(<AddExpenseView {...props()} />);

    expect(screen.getByRole('button', { name: 'Type an amount' })).toBeDisabled();
  });

  it('saves from the keypad submit key with the chosen category in its label', async () => {
    const onSave = jest.fn();
    await renderAdd(<AddExpenseView {...props({ typed: '84.00', onSave })} />, 'pl');

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: /^Dodaj 84,00 zł do: Groceries/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('reports the chosen category and account', async () => {
    const onCategoryChange = jest.fn();
    const onAccountChange = jest.fn();
    await renderAdd(<AddExpenseView {...props({ onCategoryChange, onAccountChange })} />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('radio', { name: 'Transport' }));
    await user.press(screen.getByRole('radio', { name: 'Cash' }));

    expect(onCategoryChange).toHaveBeenCalledWith('transport');
    expect(onAccountChange).toHaveBeenCalledWith('cash');
  });

  it('shows the saved state with the new safe to spend, Undo and Add another', async () => {
    const onUndo = jest.fn();
    const onAddAnother = jest.fn();
    await renderAdd(
      <AddExpenseView {...props({ typed: '84.00', status: 'saved', onUndo, onAddAnother })} />,
    );
    const user = userEvent.setup();

    expect(screen.getByText('Saved · counted in October')).toBeTruthy();
    expect(screen.getByText(/Safe to spend today is now/)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Transport' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Undo' }));
    await user.press(screen.getByRole('button', { name: 'Add another' }));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onAddAnother).toHaveBeenCalledTimes(1);
  });

  it('shows a save error and keeps the keypad', async () => {
    await renderAdd(<AddExpenseView {...props({ typed: '5', error: 'Could not save' })} />);

    expect(screen.getByText('Could not save')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: '5' })).queryAllByText('5').length).toBe(1);
  });
});

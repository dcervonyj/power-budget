import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { renderGlass } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import { PlanEditorView, type PlanEditorViewProps } from '../PlanEditorView.js';
import type { PlanItemRowModel } from '../planModels.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const PLAN: PlanDto = {
  id: 'plan-1',
  name: 'October',
  type: 'personal',
  ownerUserId: null,
  periodKind: 'monthly',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const SALARY: PlanItemRowModel = {
  id: 'i-salary',
  name: 'Salary',
  direction: 'income',
  amountMinor: '840000',
  currency: 'PLN',
  amountInput: '8400.00',
  spentMinor: null,
};

const GROCERIES: PlanItemRowModel = {
  id: 'l-food',
  name: 'Groceries',
  direction: 'expense',
  amountMinor: '220000',
  currency: 'PLN',
  amountInput: '2200.00',
  spentMinor: 114864n,
};

function props(overrides: Partial<PlanEditorViewProps> = {}): PlanEditorViewProps {
  return {
    plan: PLAN,
    totals: {
      currency: 'PLN',
      incomeMinor: 840000n,
      expensesMinor: 220000n,
      leftMinor: 620000n,
      excludedCount: 0,
    },
    income: [SALARY],
    limits: [GROCERIES],
    draft: { categoryId: '', direction: 'expense', amount: '' },
    draftCategories: [{ value: 'cat-home', label: 'Home' }],
    saving: false,
    saveError: null,
    onNameChange: jest.fn(),
    onBaseCurrencyChange: jest.fn(),
    onCustomDatesChange: jest.fn(),
    onDraftChange: jest.fn(),
    onAddItem: jest.fn(),
    onSave: jest.fn(),
    onArchive: jest.fn(),
    onAmountChange: jest.fn(),
    onRemove: jest.fn(),
    ...overrides,
  };
}

describe('PlanEditorView totals', () => {
  it('shows income, planned and left with a Within income tag', async () => {
    await renderGlass(<PlanEditorView {...props()} />);

    expect(screen.getByLabelText('Plan totals')).toBeTruthy();
    expect(screen.getAllByText(/8,400\.00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Left to plan')).toBeTruthy();
    expect(screen.getByText('Within income')).toBeTruthy();
    expect(screen.queryByText('Over income')).toBeNull();
  });

  it('flags a plan whose limits exceed its income and counts excluded items', async () => {
    await renderGlass(
      <PlanEditorView
        {...props({
          totals: {
            currency: 'PLN',
            incomeMinor: 100n,
            expensesMinor: 300n,
            leftMinor: -200n,
            excludedCount: 2,
          },
        })}
      />,
    );

    expect(screen.getByText('Over income')).toBeTruthy();
    expect(screen.getByText('2 items in other currencies are not counted')).toBeTruthy();
  });
});

describe('PlanEditorView limits', () => {
  it('steps a limit by 10 major units in exact minor units', async () => {
    const onAmountChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onAmountChange })} />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Increase the Groceries limit' }));
    await user.press(screen.getByRole('button', { name: 'Decrease the Groceries limit' }));

    expect(onAmountChange).toHaveBeenNthCalledWith(1, 'l-food', '221000');
    expect(onAmountChange).toHaveBeenNthCalledWith(2, 'l-food', '219000');
  });

  it('shows an empty note when there are no limits or income', async () => {
    await renderGlass(<PlanEditorView {...props({ limits: [], income: [] })} />);

    expect(screen.getByText('No category limits yet')).toBeTruthy();
    expect(screen.getByText('No income planned yet')).toBeTruthy();
  });

  it('removes an item', async () => {
    const onRemove = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onRemove })} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Remove Salary' }));

    expect(onRemove).toHaveBeenCalledWith('i-salary');
  });
});

describe('PlanEditorView amount input (core parsing)', () => {
  it('commits the typed amount as exact minor units', async () => {
    const onAmountChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onAmountChange })} />);
    const field = screen.getByLabelText('Salary amount');

    await fireEvent.changeText(field, '9 000,30');
    await fireEvent(field, 'endEditing');

    expect(onAmountChange).toHaveBeenCalledWith('i-salary', '900030');
  });

  it('keeps cents exact where parseFloat would not (0.30)', async () => {
    const onAmountChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onAmountChange })} />);
    const field = screen.getByLabelText('Salary amount');

    await fireEvent.changeText(field, '0.30');
    await fireEvent(field, 'endEditing');

    expect(onAmountChange).toHaveBeenCalledWith('i-salary', '30');
  });

  it('reverts text that is not an amount and reports nothing', async () => {
    const onAmountChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onAmountChange })} />);
    const field = screen.getByLabelText('Salary amount');

    await fireEvent.changeText(field, 'abc');
    await fireEvent(field, 'endEditing');

    expect(onAmountChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Salary amount').props.value).toBe('8400.00');
  });

  it('does not report an unchanged amount', async () => {
    const onAmountChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onAmountChange })} />);
    const field = screen.getByLabelText('Salary amount');

    await fireEvent.changeText(field, '8400');
    await fireEvent(field, 'endEditing');

    expect(onAmountChange).not.toHaveBeenCalled();
  });
});

describe('PlanEditorView actions', () => {
  it('saves, archives and adds an item', async () => {
    const onSave = jest.fn();
    const onArchive = jest.fn();
    const onAddItem = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onSave, onArchive, onAddItem })} />);
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Save' }));
    await user.press(screen.getByRole('button', { name: 'Add item' }));
    await user.press(screen.getByRole('button', { name: 'Archive plan' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onAddItem).toHaveBeenCalledTimes(1);
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('types the draft amount and switches direction, clearing the category', async () => {
    const onDraftChange = jest.fn();
    const draft = { categoryId: 'cat-home', direction: 'expense' as const, amount: '' };
    await renderGlass(<PlanEditorView {...props({ draft, onDraftChange })} />);

    await fireEvent.changeText(screen.getByLabelText('Amount in PLN'), '12,5');
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Income' }));

    expect(onDraftChange).toHaveBeenNthCalledWith(1, { ...draft, amount: '12,5' });
    expect(onDraftChange).toHaveBeenNthCalledWith(2, {
      categoryId: '',
      direction: 'income',
      amount: '',
    });
  });

  it('shows the save error', async () => {
    await renderGlass(<PlanEditorView {...props({ saveError: 'Could not save the plan.' })} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not save the plan.')).toBeTruthy();
  });

  it('edits the name', async () => {
    const onNameChange = jest.fn();
    await renderGlass(<PlanEditorView {...props({ onNameChange })} />);

    await fireEvent.changeText(screen.getByDisplayValue('October'), 'November');

    expect(onNameChange).toHaveBeenCalledWith('November');
  });
});

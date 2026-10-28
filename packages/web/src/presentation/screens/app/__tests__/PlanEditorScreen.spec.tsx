import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { categoriesApi, plansApi, settingsStore } from '../../../../composition.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';
import { PlanEditorScreen } from '../PlanEditorScreen.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import {
  CATEGORIES,
  DASHBOARD,
  ITEMS,
  PLAN,
  RENT_ITEM,
} from '../../../../test/dashboardFixtures.js';

spyOnApiClient();
const plansSpies = {
  get: vi.spyOn(plansApi, 'get'),
  listItems: vi.spyOn(plansApi, 'listItems'),
  createItem: vi.spyOn(plansApi, 'createItem'),
  updateItem: vi.spyOn(plansApi, 'updateItem'),
  update: vi.spyOn(plansApi, 'update'),
  dashboard: vi.spyOn(plansApi, 'dashboard'),
};
const categoriesList = vi.spyOn(categoriesApi, 'list');
const loadProfile = vi.spyOn(settingsStore, 'loadProfile');

function signInSettingsStore(): void {
  settingsStore.profileLoaded = true;
  settingsStore.userId = 'user-1';
  loadProfile.mockResolvedValue(undefined);
}

describe('PlanEditorScreen amounts (UI-013)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInSettingsStore();
    plansSpies.get.mockResolvedValue(PLAN);
    plansSpies.listItems.mockResolvedValue([RENT_ITEM]);
    categoriesList.mockResolvedValue(CATEGORIES);
    plansSpies.dashboard.mockRejectedValue(new Error('no dashboard'));
  });

  it('shows a stored item in normal units, not minor units', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    const amounts = await screen.findAllByLabelText('Amount');
    expect(amounts[0]).toHaveValue('3000.00');
  });

  it('sends what the user typed as exact minor units', async () => {
    plansSpies.createItem.mockResolvedValue({
      ...RENT_ITEM,
      id: 'item-new',
      categoryId: 'cat-groceries',
      amount: { amountMinor: '25050', currency: 'PLN' },
    });
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    const category = container.querySelector('#plan-new-item-category');
    if (category === null) {
      throw new Error('no category select in the new item row');
    }
    fireEvent.change(category, { target: { value: 'cat-groceries' } });
    const amountInputs = screen.getAllByLabelText('Amount');
    fireEvent.change(amountInputs[amountInputs.length - 1] ?? document.body, {
      target: { value: '250,50' },
    });
    const currencyInputs = screen.getAllByLabelText('Currency');
    fireEvent.change(currencyInputs[currencyInputs.length - 1] ?? document.body, {
      target: { value: 'pln' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    await waitFor(() => {
      expect(plansSpies.createItem).toHaveBeenCalledWith('plan-1', {
        categoryId: 'cat-groceries',
        direction: 'expense',
        amountMinor: '25050',
        currency: 'PLN',
      });
    });
  });

  it('saves an edited amount as minor units on blur', async () => {
    plansSpies.updateItem.mockResolvedValue({
      ...RENT_ITEM,
      amount: { amountMinor: '320000', currency: 'PLN' },
    });
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const [stored] = await screen.findAllByLabelText('Amount');

    fireEvent.blur(stored ?? document.body, { target: { value: '3 200' } });

    await waitFor(() => {
      expect(plansSpies.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        amountMinor: '320000',
        currency: 'PLN',
      });
    });
  });
});

describe('PlanEditorScreen silent failures (CLN-047)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plansApi.get).mockResolvedValue(PLAN);
    vi.mocked(plansApi.listItems).mockResolvedValue([RENT_ITEM]);
    vi.mocked(categoriesApi.list).mockResolvedValue(CATEGORIES);
    vi.mocked(plansApi.dashboard).mockRejectedValue(new Error('no dashboard'));
  });

  it('prefills the new item currency with the plan currency', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const currencies = await screen.findAllByLabelText('Currency');

    expect(currencies[currencies.length - 1]).toHaveValue(PLAN.baseCurrency);
  });

  it('shows a field error for a missing category and amount instead of doing nothing', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    await screen.findAllByLabelText('Amount');

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Choose a category for the item.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid amount, for example 250.50.')).toBeInTheDocument();
    expect(plansApi.createItem).not.toHaveBeenCalled();
  });

  it('reports only the currency, not the amount, when the currency is empty', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    await screen.findAllByLabelText('Amount');
    const currencies = screen.getAllByLabelText('Currency');
    fireEvent.change(currencies[currencies.length - 1] ?? document.body, {
      target: { value: '' },
    });
    const amounts = screen.getAllByLabelText('Amount');
    fireEvent.change(amounts[amounts.length - 1] ?? document.body, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(
      await screen.findByText('Enter a supported currency code, for example PLN.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Enter a valid amount, for example 250.50.')).toBeNull();
  });

  it('clears the kept-amount message on the next edit', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const [stored] = await screen.findAllByLabelText('Amount');
    fireEvent.change(stored ?? document.body, { target: { value: 'abc' } });
    fireEvent.blur(stored ?? document.body);
    await screen.findByText(/That amount is not valid/);
    vi.mocked(plansApi.updateItem).mockResolvedValue({
      ...RENT_ITEM,
      amount: { amountMinor: '320000', currency: 'PLN' },
    });

    fireEvent.change(stored ?? document.body, { target: { value: '3200' } });
    fireEvent.blur(stored ?? document.body);

    await waitFor(() => {
      expect(screen.queryByText(/That amount is not valid/)).toBeNull();
    });
  });

  it('clears the field errors when the user edits the row', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    await screen.findAllByLabelText('Amount');
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    await screen.findByText('Choose a category for the item.');
    const amounts = screen.getAllByLabelText('Amount');

    fireEvent.change(amounts[amounts.length - 1] ?? document.body, { target: { value: '5' } });

    expect(screen.queryByText('Choose a category for the item.')).toBeNull();
  });

  it('tells the user when an inline amount is not valid and restores the stored amount', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const [stored] = await screen.findAllByLabelText('Amount');

    fireEvent.change(stored ?? document.body, { target: { value: 'abc' } });
    fireEvent.blur(stored ?? document.body);

    expect(await screen.findByText(/That amount is not valid/)).toBeInTheDocument();
    expect(stored).toHaveValue('3000.00');
    expect(plansApi.updateItem).not.toHaveBeenCalled();
  });
});

describe('PlanEditorScreen D7 plan layout (DSN-023)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInSettingsStore();
    plansSpies.get.mockResolvedValue(PLAN);
    plansSpies.listItems.mockResolvedValue(ITEMS);
    categoriesList.mockResolvedValue(CATEGORIES);
    plansSpies.dashboard.mockResolvedValue(DASHBOARD);
  });

  it('shows the totals tiles in the plan currency and leaves other currencies out', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    const totals = await screen.findByRole('region', { name: 'Plan totals' });

    expect(within(totals).getByText('Income')).toBeInTheDocument();
    expect(within(totals).getByText('Planned')).toBeInTheDocument();
    expect(within(totals).getByText('Left to plan')).toBeInTheDocument();
    // Salary 10 000, groceries 1 500 and rent 3 000 in PLN; the EUR item is not summed.
    expect(totals.textContent.replace(/\s/g, ' ')).toBe(
      'Incomezł 10,000.00Plannedzł 4,500.00Left to planzł 5,500.00Within income1 item in another currency is not counted',
    );
    expect(totals).toHaveTextContent('Within income');
    expect(totals).toHaveTextContent('1 item in another currency is not counted');
  });

  it('keeps the editor alive while the base currency is cleared or half typed', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const currency = await screen.findByLabelText('Base currency');

    fireEvent.change(currency, { target: { value: '' } });
    fireEvent.change(currency, { target: { value: 'E' } });

    expect(screen.getByRole('region', { name: 'Plan totals' })).toHaveTextContent('10,000.00');
  });

  it('keeps the editor alive while a custom period date is cleared', async () => {
    plansSpies.get.mockResolvedValue({ ...PLAN, periodKind: 'custom' });
    plansSpies.update.mockResolvedValue({
      ...PLAN,
      periodKind: 'custom',
      period: { start: '', end: PLAN.period.end },
    });
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const start = await screen.findByLabelText(/start/i);

    fireEvent.change(start, { target: { value: '' } });

    expect(await screen.findByRole('heading', { name: 'Plan Editor' })).toBeInTheDocument();
  });

  it('splits income from category limits and shows a category row with its spent amount', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    expect(await screen.findByRole('heading', { name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Category limits' })).toBeInTheDocument();
    expect(screen.getAllByTestId('category-row').length).toBeGreaterThan(0);
  });

  it('moves a limit by one step with the stepper and sends exact minor units', async () => {
    plansSpies.updateItem.mockResolvedValue({
      ...RENT_ITEM,
      amount: { amountMinor: '301000', currency: 'PLN' },
    });
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    fireEvent.click(await screen.findByRole('button', { name: 'Increase the Rent limit' }));

    await waitFor(() => {
      expect(plansSpies.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        amountMinor: '301000',
        currency: 'PLN',
      });
    });
  });

  it('keeps keyboard entry for a limit when the stepper is there', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    const stepper = await screen.findByRole('spinbutton', { name: 'Rent limit' });
    fireEvent.keyDown(stepper, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(plansSpies.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        amountMinor: '299000',
        currency: 'PLN',
      });
    });
  });

  it('still lists the items when the dashboard cannot be read', async () => {
    plansSpies.dashboard.mockRejectedValue(new Error('down'));
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    expect(await screen.findAllByLabelText('Amount')).not.toHaveLength(0);
    expect(screen.queryAllByTestId('category-row')).toHaveLength(0);
  });

  it('does not render the what-if panel or the goal tube', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    await screen.findByRole('region', { name: 'Plan totals' });

    expect(screen.queryByText(/what.?if/i)).toBeNull();
    expect(screen.queryByTestId('tube')).toBeNull();
  });
});

describe('PlanEditorScreen match hints (AI-004)', () => {
  const HINT = {
    counterpartyPattern: 'Landlord',
    amountMinor: '300000',
    toleranceMinor: '5000',
    dayOfMonth: 5,
    dayWindow: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    signInSettingsStore();
    plansSpies.get.mockResolvedValue(PLAN);
    categoriesList.mockResolvedValue(CATEGORIES);
    plansSpies.dashboard.mockRejectedValue(new Error('no dashboard'));
  });

  it('shows a stored hint in the item row in normal units', async () => {
    plansSpies.listItems.mockResolvedValue([{ ...RENT_ITEM, matchHint: HINT }]);
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    expect(container.querySelector('#plan-item-item-rent-hint-counterpartyPattern')).toHaveValue(
      'Landlord',
    );
    expect(container.querySelector('#plan-item-item-rent-hint-amount')).toHaveValue('3000.00');
    expect(container.querySelector('#plan-item-item-rent-hint-tolerance')).toHaveValue('50.00');
    expect(container.querySelector('#plan-item-item-rent-hint-dayOfMonth')).toHaveValue('5');
    expect(container.querySelector('#plan-item-item-rent-hint-dayWindow')).toHaveValue('2');
  });

  it('saves an edited hint on its own, as minor units', async () => {
    plansSpies.listItems.mockResolvedValue([RENT_ITEM]);
    plansSpies.updateItem.mockResolvedValue({ ...RENT_ITEM, matchHint: HINT });
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    const typeInto = (name: string, value: string): void => {
      const input = container.querySelector(`#plan-item-item-rent-hint-${name}`);
      fireEvent.change(input ?? document.body, { target: { value } });
    };
    typeInto('counterpartyPattern', 'Landlord');
    typeInto('amount', '3000');
    typeInto('tolerance', '50');
    typeInto('dayOfMonth', '5');
    typeInto('dayWindow', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Save hint' }));

    await waitFor(() => {
      expect(plansSpies.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        matchHint: HINT,
      });
    });
  });

  it('clears the hint when every field is emptied', async () => {
    plansSpies.listItems.mockResolvedValue([{ ...RENT_ITEM, matchHint: HINT }]);
    plansSpies.updateItem.mockResolvedValue({ ...RENT_ITEM, matchHint: null });
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    for (const name of ['counterpartyPattern', 'amount', 'tolerance', 'dayOfMonth', 'dayWindow']) {
      const input = container.querySelector(`#plan-item-item-rent-hint-${name}`);
      fireEvent.change(input ?? document.body, { target: { value: '' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save hint' }));

    await waitFor(() => {
      expect(plansSpies.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        matchHint: null,
      });
    });
  });

  it('flags an invalid hint without calling the API', async () => {
    plansSpies.listItems.mockResolvedValue([RENT_ITEM]);
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    const tolerance = container.querySelector('#plan-item-item-rent-hint-tolerance');
    fireEvent.change(tolerance ?? document.body, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save hint' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Check the highlighted hint fields');
    expect(plansSpies.updateItem).not.toHaveBeenCalled();
  });

  it('sends the hint typed into the new item row', async () => {
    plansSpies.listItems.mockResolvedValue([RENT_ITEM]);
    plansSpies.createItem.mockResolvedValue({ ...RENT_ITEM, id: 'item-new', matchHint: HINT });
    const { container } = renderWithProviders(<PlanEditorScreen />, {
      url: '/plans/plan-1',
      path: '/plans/:id',
    });
    await screen.findAllByLabelText('Amount');

    fireEvent.change(container.querySelector('#plan-new-item-category') ?? document.body, {
      target: { value: 'cat-groceries' },
    });
    const amounts = screen.getAllByLabelText('Amount');
    fireEvent.change(amounts[amounts.length - 1] ?? document.body, { target: { value: '10' } });
    fireEvent.change(
      container.querySelector('#plan-new-item-hint-counterpartyPattern') ?? document.body,
      {
        target: { value: 'Netflix' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    await waitFor(() => {
      expect(plansSpies.createItem).toHaveBeenCalledWith('plan-1', {
        categoryId: 'cat-groceries',
        direction: 'expense',
        amountMinor: '1000',
        currency: 'PLN',
        matchHint: {
          counterpartyPattern: 'Netflix',
          amountMinor: null,
          toleranceMinor: null,
          dayOfMonth: null,
          dayWindow: null,
        },
      });
    });
  });
});

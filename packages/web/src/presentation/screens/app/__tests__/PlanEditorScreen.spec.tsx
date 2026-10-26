import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { categoriesApi, plansApi } from '../../../../AppProviders.js';
import { PlanEditorScreen } from '../PlanEditorScreen.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import {
  CATEGORIES,
  DASHBOARD,
  ITEMS,
  PLAN,
  RENT_ITEM,
} from '../../../../test/dashboardFixtures.js';

vi.mock('../../../../AppProviders.js', () => ({
  plansApi: {
    get: vi.fn(),
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    update: vi.fn(),
    dashboard: vi.fn(),
  },
  categoriesApi: { list: vi.fn() },
}));
vi.mock('../../../../application/settings/SettingsStore.js', () => ({
  settingsStore: { profileLoaded: true, userId: 'user-1', loadProfile: vi.fn() },
}));

describe('PlanEditorScreen amounts (UI-013)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plansApi.get).mockResolvedValue(PLAN);
    vi.mocked(plansApi.listItems).mockResolvedValue([RENT_ITEM]);
    vi.mocked(categoriesApi.list).mockResolvedValue(CATEGORIES);
    vi.mocked(plansApi.dashboard).mockRejectedValue(new Error('no dashboard'));
  });

  it('shows a stored item in normal units, not minor units', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    const amounts = await screen.findAllByLabelText('Amount');
    expect(amounts[0]).toHaveValue('3000.00');
  });

  it('sends what the user typed as exact minor units', async () => {
    vi.mocked(plansApi.createItem).mockResolvedValue({
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
      expect(plansApi.createItem).toHaveBeenCalledWith('plan-1', {
        categoryId: 'cat-groceries',
        direction: 'expense',
        amountMinor: '25050',
        currency: 'PLN',
      });
    });
  });

  it('saves an edited amount as minor units on blur', async () => {
    vi.mocked(plansApi.updateItem).mockResolvedValue({
      ...RENT_ITEM,
      amount: { amountMinor: '320000', currency: 'PLN' },
    });
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });
    const [stored] = await screen.findAllByLabelText('Amount');

    fireEvent.blur(stored ?? document.body, { target: { value: '3 200' } });

    await waitFor(() => {
      expect(plansApi.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        amountMinor: '320000',
        currency: 'PLN',
      });
    });
  });
});

describe('PlanEditorScreen D7 plan layout (DSN-023)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plansApi.get).mockResolvedValue(PLAN);
    vi.mocked(plansApi.listItems).mockResolvedValue(ITEMS);
    vi.mocked(categoriesApi.list).mockResolvedValue(CATEGORIES);
    vi.mocked(plansApi.dashboard).mockResolvedValue(DASHBOARD);
  });

  it('shows the totals tiles in the plan currency and leaves other currencies out', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    const totals = await screen.findByRole('region', { name: 'Plan totals' });

    expect(within(totals).getByText('Income')).toBeInTheDocument();
    expect(within(totals).getByText('Planned')).toBeInTheDocument();
    expect(within(totals).getByText('Left to plan')).toBeInTheDocument();
    // Salary 10 000, groceries 1 500 and rent 3 000 in PLN; the EUR item is not summed.
    expect(totals).toHaveTextContent('10');
    expect(totals).toHaveTextContent('Within income');
    expect(totals).toHaveTextContent('1 item in another currency is not counted');
  });

  it('splits income from category limits and shows a category row with its spent amount', async () => {
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    expect(await screen.findByRole('heading', { name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Category limits' })).toBeInTheDocument();
    expect(screen.getAllByTestId('category-row').length).toBeGreaterThan(0);
  });

  it('moves a limit by one step with the stepper and sends exact minor units', async () => {
    vi.mocked(plansApi.updateItem).mockResolvedValue({
      ...RENT_ITEM,
      amount: { amountMinor: '301000', currency: 'PLN' },
    });
    renderWithProviders(<PlanEditorScreen />, { url: '/plans/plan-1', path: '/plans/:id' });

    fireEvent.click(await screen.findByRole('button', { name: 'Increase the Rent limit' }));

    await waitFor(() => {
      expect(plansApi.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
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
      expect(plansApi.updateItem).toHaveBeenCalledWith('plan-1', 'item-rent', {
        amountMinor: '299000',
        currency: 'PLN',
      });
    });
  });

  it('still lists the items when the dashboard cannot be read', async () => {
    vi.mocked(plansApi.dashboard).mockRejectedValue(new Error('down'));
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

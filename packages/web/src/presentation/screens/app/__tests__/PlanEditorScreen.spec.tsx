import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { categoriesApi, plansApi } from '../../../../AppProviders.js';
import { PlanEditorScreen } from '../PlanEditorScreen.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { CATEGORIES, PLAN, RENT_ITEM } from '../../../../test/dashboardFixtures.js';

vi.mock('../../../../AppProviders.js', () => ({
  plansApi: {
    get: vi.fn(),
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    update: vi.fn(),
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

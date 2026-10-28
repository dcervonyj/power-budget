import React from 'react';
import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { CategoryDto, PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';
import { renderGlass } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import { PlanEditorScreen } from '../../PlanEditorScreen.js';
import { PlansListScreen } from '../../PlansListScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockApi = {
  list: jest.fn(),
  get: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  archive: jest.fn(),
  listItems: jest.fn(),
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  dashboard: jest.fn(),
};
const mockCategories = { list: jest.fn() };

function resetApiMocks(): void {
  for (const fn of [...Object.values(mockApi), mockCategories.list]) {
    fn.mockReset();
  }
}

jest.mock('../../../../../infrastructure/index.js', () => ({
  plansApi: {
    list: (status: string): Promise<unknown> => mockApi.list(status),
    get: (id: string): Promise<unknown> => mockApi.get(id),
    create: (body: unknown): Promise<unknown> => mockApi.create(body),
    update: (id: string, body: unknown): Promise<unknown> => mockApi.update(id, body),
    archive: (id: string): Promise<unknown> => mockApi.archive(id),
    listItems: (id: string): Promise<unknown> => mockApi.listItems(id),
    createItem: (id: string, body: unknown): Promise<unknown> => mockApi.createItem(id, body),
    updateItem: (id: string, itemId: string, body: unknown): Promise<unknown> =>
      mockApi.updateItem(id, itemId, body),
    deleteItem: (id: string, itemId: string): Promise<unknown> => mockApi.deleteItem(id, itemId),
    dashboard: (id: string): Promise<unknown> => mockApi.dashboard(id),
  },
  categoriesApi: { list: (): Promise<unknown> => mockCategories.list() },
}));

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

const ITEM: PlannedItemDto = {
  id: 'item-1',
  planId: 'plan-1',
  categoryId: 'cat-food',
  direction: 'expense',
  amount: { amountMinor: '220000', currency: 'PLN' },
  note: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const FOOD: CategoryDto = {
  id: 'cat-food',
  name: 'Groceries',
  kind: 'expense',
  icon: 'cart',
  color: '#fff',
  isSystem: false,
  seedKey: null,
  privacy: 'full_detail',
  archived: false,
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

function editorProps(): React.ComponentProps<typeof PlanEditorScreen> {
  return {
    route: { key: 'k', name: 'PlanEditor', params: { planId: 'plan-1' } },
    navigation: { goBack: jest.fn(), replace: jest.fn() },
  } as unknown as React.ComponentProps<typeof PlanEditorScreen>;
}

describe('PlanEditorScreen', () => {
  beforeEach(() => {
    resetApiMocks();
    mockApi.get.mockResolvedValue(PLAN);
    mockApi.listItems.mockResolvedValue([ITEM]);
    mockApi.dashboard.mockRejectedValue(new Error('no dashboard'));
    mockCategories.list.mockResolvedValue([FOOD]);
  });

  it('loads the plan and saves an edited amount as exact minor units', async () => {
    const updated = { ...ITEM, amount: { amountMinor: '900030', currency: 'PLN' } };
    mockApi.updateItem.mockResolvedValue(updated);
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const field = await screen.findByLabelText('Groceries amount');
    expect(field.props.value).toBe('2200.00');
    await fireEvent.changeText(field, '9 000,30');
    await fireEvent(field, 'endEditing');

    await waitFor(() => {
      expect(mockApi.updateItem).toHaveBeenCalledWith('plan-1', 'item-1', {
        amountMinor: '900030',
        currency: 'PLN',
      });
    });
    expect(mockApi.updateItem).toHaveBeenCalledTimes(1);
  });

  it('rolls an amount back and shows an error when the save fails', async () => {
    mockApi.updateItem.mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('boom')), 20)),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const field = await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(field, '10');
    await fireEvent(field, 'endEditing');

    expect(await screen.findByText('Could not update the item.')).toBeTruthy();
    expect(screen.getByLabelText('Groceries amount').props.value).toBe('2200.00');
  });

  it('shows a retry when the plan cannot be loaded', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('offline'));
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    expect(await screen.findByText('Could not load the plan.')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Groceries amount')).toBeTruthy();
  });

  it('refuses to add an item without a category', async () => {
    mockApi.createItem.mockResolvedValue({ ...ITEM, id: 'item-2' });
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(screen.getByLabelText('Amount in PLN'), '0.30');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Choose a category and enter an amount.')).toBeTruthy();
    expect(mockApi.createItem).not.toHaveBeenCalled();
  });
});

describe('PlansListScreen', () => {
  function listProps(navigate: jest.Mock): React.ComponentProps<typeof PlansListScreen> {
    return {
      navigation: { navigate, addListener: jest.fn().mockReturnValue(jest.fn()) },
    } as unknown as React.ComponentProps<typeof PlansListScreen>;
  }

  beforeEach(() => {
    resetApiMocks();
    mockApi.list.mockResolvedValue([PLAN]);
  });

  it('lists all plans and opens one', async () => {
    const navigate = jest.fn();
    await renderGlass(<PlansListScreen {...listProps(navigate)} />);

    await userEvent.setup().press(await screen.findByRole('button', { name: /October/ }));

    expect(mockApi.list).toHaveBeenCalledWith('all');
    expect(navigate).toHaveBeenCalledWith('PlanEditor', { planId: 'plan-1' });
  });

  it('creates a monthly plan and opens it in the editor', async () => {
    const navigate = jest.fn();
    mockApi.create.mockResolvedValue({ ...PLAN, id: 'plan-new' });
    await renderGlass(<PlansListScreen {...listProps(navigate)} />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Create new plan' }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('PlanEditor', { planId: 'plan-new' });
    });
    expect(mockApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New plan', type: 'personal', periodKind: 'monthly' }),
    );
  });

  it('shows a retryable error when the plans cannot be loaded', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('offline'));
    await renderGlass(<PlansListScreen {...listProps(jest.fn())} />);

    expect(await screen.findByText('Could not load plans. Please try again.')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: /October/ })).toBeTruthy();
  });
});

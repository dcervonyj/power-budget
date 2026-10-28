import React from 'react';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { CategoryDto, PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';
import { renderGlass } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import { PlanEditorScreen } from '../../PlanEditorScreen.js';
import { PlansListScreen } from '../../PlansListScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../../components/CustomPeriodPicker.js', () => {
  const { Pressable, Text } = jest.requireActual('react-native');

  return {
    CustomPeriodPicker: ({ onChange }: { onChange: (start: string, end: string) => void }) => (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick dates"
          onPress={() => {
            onChange('2026-10-02', '2026-10-20');
          }}
        >
          <Text>dates</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick later dates"
          onPress={() => {
            onChange('2026-10-05', '2026-10-25');
          }}
        >
          <Text>later</Text>
        </Pressable>
      </>
    ),
  };
});

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
  matchHint: null,
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

  it('labels an item by its category id when the category list lacks it', async () => {
    mockCategories.list.mockResolvedValue([]);
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    expect(await screen.findByLabelText(`${ITEM.categoryId} amount`)).toBeTruthy();
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
    await waitFor(() => {
      expect(screen.getByLabelText('Groceries amount').props.value).toBe('2200.00');
    });
  });

  it('keeps an unsaved name when custom dates are saved', async () => {
    const custom = { ...PLAN, periodKind: 'custom' };
    mockApi.get.mockResolvedValue(custom);
    mockApi.update.mockResolvedValue({
      ...custom,
      name: 'Server name',
      period: { start: '2026-10-02', end: '2026-10-20' },
    });
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const name = await screen.findByLabelText('Plan name');
    await fireEvent.changeText(name, 'My draft');
    await fireEvent(screen.getByLabelText('Plan name'), 'blur');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Pick dates' }));

    await waitFor(() => {
      expect(mockApi.update).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText('Plan name').props.value).toBe('My draft');
  });

  it('saves amounts of one item in order and keeps the newest value', async () => {
    const resolvers: Array<() => void> = [];
    mockApi.updateItem.mockImplementation(
      (_plan: string, _item: string, body: { amountMinor: string }) =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({ ...ITEM, amount: { amountMinor: body.amountMinor, currency: 'PLN' } }),
          );
        }),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const field = await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(field, '10');
    await fireEvent(field, 'endEditing');
    await fireEvent.changeText(screen.getByLabelText('Groceries amount'), '20');
    await fireEvent(screen.getByLabelText('Groceries amount'), 'endEditing');

    expect(mockApi.updateItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvers[0]();
    });
    await waitFor(() => {
      expect(mockApi.updateItem).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      resolvers[1]();
    });

    expect(mockApi.updateItem.mock.calls[1][2]).toEqual({ amountMinor: '2000', currency: 'PLN' });
    await waitFor(() => {
      expect(screen.getByLabelText('Groceries amount').props.value).toBe('20.00');
    });
  });

  it('rolls back only the failed item', async () => {
    const second = { ...ITEM, id: 'item-2', categoryId: 'cat-rent' };
    mockApi.listItems.mockResolvedValue([ITEM, second]);
    mockCategories.list.mockResolvedValue([FOOD, { ...FOOD, id: 'cat-rent', name: 'Rent' }]);
    mockApi.updateItem.mockImplementation(
      (_plan: string, itemId: string, body: { amountMinor: string }) =>
        itemId === 'item-1'
          ? new Promise((_resolve, reject) => setTimeout(() => reject(new Error('boom')), 30))
          : Promise.resolve({
              ...second,
              amount: { amountMinor: body.amountMinor, currency: 'PLN' },
            }),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const food = await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(food, '10');
    await fireEvent(food, 'endEditing');
    const rent = screen.getByLabelText('Rent amount');
    await fireEvent.changeText(rent, '30');
    await fireEvent(rent, 'endEditing');

    expect(await screen.findByText('Could not update the item.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Groceries amount').props.value).toBe('2200.00');
    });
    expect(screen.getByLabelText('Rent amount').props.value).toBe('30.00');
  });

  it('keeps another item edit that already saved when one item fails', async () => {
    const second = { ...ITEM, id: 'item-2', categoryId: 'cat-rent' };
    mockApi.listItems.mockResolvedValue([ITEM, second]);
    mockCategories.list.mockResolvedValue([FOOD, { ...FOOD, id: 'cat-rent', name: 'Rent' }]);
    mockApi.updateItem.mockImplementation(
      (_plan: string, itemId: string, body: { amountMinor: string }) =>
        itemId === 'item-2'
          ? Promise.resolve({
              ...second,
              amount: { amountMinor: body.amountMinor, currency: 'PLN' },
            })
          : new Promise((_resolve, reject) => setTimeout(() => reject(new Error('boom')), 60)),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const food = await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(food, '10');
    await fireEvent(food, 'endEditing');
    const rent = screen.getByLabelText('Rent amount');
    await fireEvent.changeText(rent, '45');
    await fireEvent(rent, 'endEditing');

    expect(await screen.findByText('Could not update the item.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Groceries amount').props.value).toBe('2200.00');
    });
    expect(screen.getByLabelText('Rent amount').props.value).toBe('45.00');
  });

  it('restores the confirmed amount when an update and then the delete both fail', async () => {
    mockApi.updateItem.mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('boom')), 60)),
    );
    mockApi.deleteItem.mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('gone')), 20)),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const field = await screen.findByLabelText('Groceries amount');
    await fireEvent.changeText(field, '10');
    await fireEvent(field, 'endEditing');
    await userEvent.setup().press(screen.getByRole('button', { name: /Remove/ }));

    expect(await screen.findByText('Could not remove the item.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText('Groceries amount').props.value).toBe('2200.00');
    });
    expect(mockApi.deleteItem).toHaveBeenCalledWith('plan-1', 'item-1');
  });

  it('saves rapid custom date changes in order, latest last', async () => {
    const custom = { ...PLAN, periodKind: 'custom' };
    mockApi.get.mockResolvedValue(custom);
    const resolvers: Array<() => void> = [];
    mockApi.update.mockImplementation(
      (_id: string, body: { periodStart: string; periodEnd: string }) =>
        new Promise((resolve) => {
          resolvers.push(() =>
            resolve({ ...custom, period: { start: body.periodStart, end: body.periodEnd } }),
          );
        }),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    const user = userEvent.setup();
    await user.press(await screen.findByRole('button', { name: 'Pick dates' }));
    await user.press(screen.getByRole('button', { name: 'Pick later dates' }));

    expect(mockApi.update).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvers[0]();
    });
    await waitFor(() => {
      expect(mockApi.update).toHaveBeenCalledTimes(2);
    });
    expect(mockApi.update.mock.calls[1][1]).toEqual({
      periodStart: '2026-10-05',
      periodEnd: '2026-10-25',
    });
  });

  it('keeps a name edited while the save is pending', async () => {
    let resolveSave: () => void = () => undefined;
    mockApi.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => resolve({ ...PLAN, name: 'October' });
        }),
    );
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Save' }));
    await fireEvent.changeText(screen.getByLabelText('Plan name'), 'Newer name');
    await act(async () => {
      resolveSave();
    });

    await waitFor(() => {
      expect(mockApi.update).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByLabelText('Plan name').props.value).toBe('Newer name');
  });

  it('shows an error and retries when categories fail to load', async () => {
    mockCategories.list.mockRejectedValueOnce(new Error('offline'));
    await renderGlass(<PlanEditorScreen {...editorProps()} />);

    expect(await screen.findByText('Could not load categories.')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.queryByText('Could not load categories.')).toBeNull();
    });
    expect(mockCategories.list).toHaveBeenCalledTimes(2);
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

  it('creates a weekly plan from the chosen period kind', async () => {
    const navigate = jest.fn();
    mockApi.create.mockResolvedValue({ ...PLAN, id: 'plan-w' });
    await renderGlass(<PlansListScreen {...listProps(navigate)} />);

    const user = userEvent.setup();
    await user.press(await screen.findByRole('radio', { name: 'Weekly' }));
    await user.press(screen.getByRole('button', { name: 'Create new plan' }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('PlanEditor', { planId: 'plan-w' });
    });
    const body = mockApi.create.mock.calls[0][0];
    expect(body.periodKind).toBe('weekly');
    expect(body.periodEnd).toBeUndefined();
  });

  it('shows a retryable error when the plans cannot be loaded', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('offline'));
    await renderGlass(<PlansListScreen {...listProps(jest.fn())} />);

    expect(await screen.findByText('Could not load plans. Please try again.')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: /October/ })).toBeTruthy();
  });
});

import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { renderGlass } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import { PlansListView, type PlansListViewProps } from '../PlansListView.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function plan(id: string, name: string, archivedAt: string | null): PlanDto {
  return {
    id,
    name,
    type: 'personal',
    ownerUserId: null,
    periodKind: 'monthly',
    period: { start: '2026-10-01', end: '2026-10-31' },
    baseCurrency: 'PLN',
    archivedAt,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function props(overrides: Partial<PlansListViewProps> = {}): PlansListViewProps {
  return {
    plans: [plan('p1', 'October', null), plan('p2', 'September', '2026-10-01T00:00:00.000Z')],
    loading: false,
    refreshing: false,
    error: null,
    creating: false,
    periodKind: 'monthly',
    onPeriodKindChange: jest.fn(),
    onCreate: jest.fn(),
    onOpen: jest.fn(),
    onRefresh: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  };
}

describe('PlansListView', () => {
  it('lists the plans with an Active or Archived tag each', async () => {
    await renderGlass(<PlansListView {...props()} />);

    expect(screen.getByRole('button', { name: /October/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /September/ })).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('opens a plan by its id', async () => {
    const onOpen = jest.fn();
    await renderGlass(<PlansListView {...props({ onOpen })} />);

    await userEvent.setup().press(screen.getByRole('button', { name: /September/ }));

    expect(onOpen).toHaveBeenCalledWith('p2');
  });

  it('reports the chosen period kind before creating', async () => {
    const onPeriodKindChange = jest.fn();
    await renderGlass(<PlansListView {...props({ onPeriodKindChange })} />);

    await userEvent.setup().press(screen.getByRole('radio', { name: 'Weekly' }));

    expect(onPeriodKindChange).toHaveBeenCalledWith('weekly');
  });

  it('creates a plan from the primary button', async () => {
    const onCreate = jest.fn();
    await renderGlass(<PlansListView {...props({ onCreate })} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Create new plan' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there are no plans', async () => {
    await renderGlass(<PlansListView {...props({ plans: [] })} />);

    expect(screen.getByText('No plans yet')).toBeTruthy();
  });

  it('shows the error with a retry and no empty state', async () => {
    const onRetry = jest.fn();
    await renderGlass(
      <PlansListView {...props({ plans: [], error: 'Could not load plans.', onRetry })} />,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No plans yet')).toBeNull();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows only a spinner while loading', async () => {
    await renderGlass(<PlansListView {...props({ loading: true })} />);

    expect(screen.queryByText('October')).toBeNull();
    expect(screen.queryByText('No plans yet')).toBeNull();
  });
});

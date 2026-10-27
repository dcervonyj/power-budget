import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import { PLAN } from '../../../../test/dashboardFixtures.js';
import { PlansListView, type PlansListViewProps } from '../PlansListView.js';

function props(overrides: Partial<PlansListViewProps> = {}): PlansListViewProps {
  return {
    plans: [PLAN],
    loading: false,
    error: null,
    creating: false,
    onCreate: vi.fn(),
    onOpen: vi.fn(),
    onClone: vi.fn(),
    onDelete: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

const ARCHIVED: PlanDto = {
  ...PLAN,
  id: 'plan-0',
  name: 'September',
  archivedAt: '2026-10-01T00:00:00.000Z',
};

describe('PlansListView', () => {
  it('shows a card per plan with its period kind, dates and status in words', () => {
    renderWithProviders(<PlansListView {...props({ plans: [PLAN, ARCHIVED] })} />);

    expect(screen.getByRole('button', { name: /October/ })).toHaveTextContent('Monthly');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('opens, clones and deletes the plan of the card', () => {
    const handlers = props();
    renderWithProviders(<PlansListView {...handlers} />);

    fireEvent.click(screen.getByRole('button', { name: /October/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(handlers.onOpen).toHaveBeenCalledWith('plan-1');
    expect(handlers.onClone).toHaveBeenCalledWith('plan-1');
    expect(handlers.onDelete).toHaveBeenCalledWith('plan-1');
  });

  it('shows the empty text', () => {
    renderWithProviders(<PlansListView {...props({ plans: [] })} />);

    expect(screen.getByText('No plans yet')).toBeInTheDocument();
  });

  it('shows the loading skeleton instead of the empty text', () => {
    renderWithProviders(<PlansListView {...props({ plans: [], loading: true })} />);

    expect(screen.queryByText('No plans yet')).toBeNull();
    expect(screen.getByRole('group', { busy: true })).toBeInTheDocument();
  });

  it('shows the load error with a retry', () => {
    renderWithProviders(<PlansListView {...props({ plans: [], error: 'Failed to load plans' })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load plans');
  });
});

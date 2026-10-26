import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import { renderWithProviders } from '../../../test/renderWithProviders.js';
import { PlannedItemHistoryView } from '../PlannedItemHistoryView.js';

const VERSION: PlannedItemVersionDto = {
  id: 'v-1',
  plannedItemId: 'item-1',
  changedBy: 'user-1',
  changedAt: '2026-10-03T10:00:00.000Z',
  reason: 'Raised',
  before: { amount: { amountMinor: '80000', currency: 'PLN' } },
  after: { amount: { amountMinor: '90000', currency: 'PLN' } },
};

describe('PlannedItemHistoryView', () => {
  it('shows who changed what, from and to, and the reason', () => {
    renderWithProviders(
      <PlannedItemHistoryView
        versions={[VERSION]}
        loading={false}
        failed={false}
        currentUserId="user-1"
      />,
    );

    expect(screen.getByText('by you')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Raised/)).toBeInTheDocument();
  });

  it('names another user as a household member', () => {
    renderWithProviders(
      <PlannedItemHistoryView
        versions={[VERSION]}
        loading={false}
        failed={false}
        currentUserId="user-2"
      />,
    );

    expect(screen.getByText('by a household member')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    renderWithProviders(
      <PlannedItemHistoryView versions={[]} loading failed={false} currentUserId="u" />,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a failed state as an alert', () => {
    renderWithProviders(
      <PlannedItemHistoryView versions={[]} loading={false} failed currentUserId="u" />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load the history');
  });

  it('shows an empty state', () => {
    renderWithProviders(
      <PlannedItemHistoryView versions={[]} loading={false} failed={false} currentUserId="u" />,
    );

    expect(screen.getByText('No history yet')).toBeInTheDocument();
  });
});
